# frozen_string_literal: true

class RunJudgeJudyJob < ApplicationJob
  queue_as :default

  # Guarantees only one judging run per (book, judge) is ever in flight -
  # whether triggered manually or via QueryDocPair's auto-run callback.
  # Discarding (rather than queueing behind the running job) matches how
  # QueryDocPair#queue_auto_run_ai_judges can fan out one enqueue per row in a
  # large bulk population: only the first wins, the rest are redundant no-ops.
  limits_concurrency to:          1,
                     key:         ->(book, judge, *) { "run_judge_judy_#{book.id}_#{judge.id}" },
                     on_conflict: :discard

  # How much of the unsure judge's explanation an escalated judgement quotes.
  # Kept short so the quote doesn't bury the on-call judge's own reasoning,
  # and so a chain (A -> B -> C) doesn't re-quote every earlier note in full.
  ESCALATION_NOTE_REASON_LENGTH = 240

  # Finds the in-flight (not finished) SolidQueue rows for this job class
  # matching the given book + judge. This is the one place that reaches into
  # SolidQueue's serialized arguments to answer "is this book+judge combo
  # actively being judged right now" - callers (the book overview page, the
  # cancel action, the live broadcast) should use this rather than
  # re-deriving it.
  def self.active_for book, judge
    book_gid  = book.to_global_id.to_s
    judge_gid = judge.to_global_id.to_s
    SolidQueue::Job
      .where(class_name: name, finished_at: nil)
      .where('arguments LIKE ? AND arguments LIKE ?', "%#{book_gid}%", "%#{judge_gid}%")
      .select do |job|
        args = job.arguments['arguments'] || []
        args.any? { |a| a.is_a?(Hash) && a['_aj_globalid'] == book_gid } &&
          args.any? { |a| a.is_a?(Hash) && a['_aj_globalid'] == judge_gid }
      end
  end

  # Force-stops any in-flight judging run for this book + judge. The one
  # place that reaches into a SolidQueue row's internals to cancel it, so
  # callers (currently just the cancel action) don't need to know that a
  # claimed (already-running) job must have its execution record destroyed
  # first, while a merely-queued job can just be discarded.
  def self.cancel book, judge
    active_for(book, judge).each do |job|
      if job.claimed_execution.present?
        # Job is actively running — force destroy it. #perform checks for
        # its own SolidQueue row on every iteration and stops as soon as it
        # notices this row is gone.
        job.claimed_execution.destroy
        job.destroy
      else
        job.discard
      end
    end
  end

  # All ai/human judge ids with an in-flight job for this book, in a single
  # scan instead of one query per judge.
  def self.actively_judging_user_ids book
    book_gid = book.to_global_id.to_s
    SolidQueue::Job
      .where(class_name: name, finished_at: nil)
      .where('arguments LIKE ?', "%#{book_gid}%")
      .filter_map do |job|
        args = job.arguments['arguments'] || []
        next unless args.any? { |a| a.is_a?(Hash) && a['_aj_globalid'] == book_gid }

        # The judge argument is always an AiJudge (an STI subclass of User,
        # perform_later is only ever called with one) - its GlobalID encodes
        # the concrete class name, e.g. gid://app/AiJudge/6, never /User/.
        judge_gid_arg = args.find { |a| a.is_a?(Hash) && a['_aj_globalid']&.include?('/AiJudge/') }
        judge_gid_arg ? GlobalID::Locator.locate(judge_gid_arg['_aj_globalid'])&.id : nil
      end.compact
  end

  # Performs AI judging on query/document pairs
  #
  # @param book [Book] The book containing query-doc pairs to judge
  # @param judge [User] The AI judge user performing the ratings
  # @param number_of_pairs [Integer, nil] Number of pairs to judge, nil for all pairs
  # @param escalating_from_judge [AiJudge, nil] Set for an on-call judge's pass: instead of
  #   choosing pairs, judge the pairs where this judge's answer was unrateable and
  #   nobody has escalated it yet (docs/todo/escalating_judges.md). Each judgement
  #   made links back to the one it answers.
  #
  # @example Judge 10 pairs
  #   RunJudgeJudyJob.perform_later(book, ai_judge, 10)
  #
  # @example Judge all pairs
  #   RunJudgeJudyJob.perform_later(book, ai_judge, nil)
  def perform book, judge, number_of_pairs, escalating_from_judge: nil
    counter = 0
    cancelled = false
    total_pairs = book.query_doc_pairs_within_rank_depth.count
    llm_service = LlmService.new judge.llm_key, judge.judge_options
    # The judge is told the book's scale, and never sees the book itself.
    scale = JudgeScale.for(book)
    # Only jobs actually dispatched through SolidQueue have a row to poll for
    # cancellation - under the :test adapter (or inline execution) there's
    # never a row to begin with, so we skip the check rather than misread
    # "never tracked" as "cancelled".
    cancellable = SolidQueue::Job.exists?(active_job_id: job_id)
    loop do
      break if number_of_pairs && counter >= number_of_pairs

      # A cancellation destroys this job's SolidQueue row out from under us;
      # this is our only chance to notice and stop, since nothing else
      # interrupts an already-running perform loop.
      if cancellable && !SolidQueue::Job.exists?(active_job_id: job_id)
        cancelled = true
        break
      end

      query_doc_pair, source = next_pair_to_judge(book, judge, escalating_from_judge)
      break if query_doc_pair.nil?

      judgement = judge_pair(llm_service, scale, query_doc_pair, judge, source)
      judgement.save!
      counter += 1
      # Sync this one pair's case ratings immediately, same as every human
      # judging path (JudgementsController, BulkJudgeController) - cheaper
      # than a full-book UpdateCaseJob resync at the end, and keeps case
      # ratings current even if a long "judge all" run gets cancelled partway.
      UpdateCaseRatingsJob.perform_later(query_doc_pair)
      BroadcastJudgeActivityJob.perform_later(book, judge)
      broadcast_judging_detail(book, judge, counter, total_pairs, judgement)

      if number_of_pairs.nil?
        broadcast_update_kraken_mode(book, counter, query_doc_pair, judge)
      else
        broadcast_update(book, number_of_pairs - counter, query_doc_pair, judge)
      end
    end
    broadcast_complete(book, judge)
    BroadcastJudgeActivityJob.perform_later(book, judge)
    wake_on_call_judge(book, judge) unless cancelled
  end

  private

  # The pair to judge next, and -- on an on-call judge's pass -- the
  # unrateable judgement it answers. nil when there is nothing left.
  def next_pair_to_judge book, judge, escalating_from_judge
    return [ SelectionStrategy.random_query_doc_based_on_strategy(book, judge), nil ] unless escalating_from_judge

    # Scoped to every judge that escalates to `judge` (judge.escalated_from),
    # not just escalating_from_judge - the limits_concurrency lock below is
    # keyed on (book, judge) alone, so if two source judges wake the same
    # on-call judge around the same time, only one enqueue wins and the
    # other is discarded. Since this query re-runs every loop iteration
    # rather than being computed once, the winning run still picks up the
    # other source's awaiting escalations instead of silently dropping them.
    source = Judgement.awaiting_escalation(book, from: judge.escalated_from, to: judge).order(:id).first
    [ source&.query_doc_pair, source ]
  end

  def judge_pair llm_service, scale, query_doc_pair, judge, source
    judgement = Judgement.new(query_doc_pair: query_doc_pair, user: judge, escalated_from_judgement: source)
    llm_service.perform_safe_judgement(judgement, scale: scale)
    JudgementFinalizer.call(judgement, scale: scale)
    judgement.explanation = "#{escalation_note(source)}#{judgement.explanation}" if source
    judgement
  end

  # The second pass: once this judge's run is done, its on-call judge (if any)
  # judges the pairs it couldn't, as a run of its own -- its own progress,
  # its own cancel, and its own (book, judge) lock. That lock discards the
  # enqueue if the on-call judge is already running on this book; whatever it
  # misses is still waiting, and the next run that ends here picks it up.
  # The on-call judge's own run ends here too, so chains (A -> B -> C) follow.
  def wake_on_call_judge book, judge
    on_call = judge.try(:escalates_to)
    return if on_call.nil?
    return unless Judgement.awaiting_escalation(book, from: judge, to: on_call).exists?

    RunJudgeJudyJob.perform_later(book, on_call, nil, escalating_from_judge: judge)
  end

  def escalation_note source
    why = source.explanation.presence&.squish&.truncate(ESCALATION_NOTE_REASON_LENGTH) || 'it gave no rating'
    "Escalated from #{source.user.name}, whose answer was unrateable: #{why}\n\n"
  end

  def broadcast_judging_detail book, judge, counter, total_pairs, judgement
    Turbo::StreamsChannel.broadcast_update_to(
      book.judgements_broadcast_channel,
      target:  "judging-activity-#{judge.id}",
      partial: 'books/judging_activity_detail',
      locals:  { book: book, judge: judge, qdp: judgement.query_doc_pair, counter: counter, total_pairs: total_pairs,
                 judgement: judgement }
    )
  end

  def broadcast_update book, counter, query_doc_pair, judge
    Turbo::StreamsChannel.broadcast_render_to(
      :notifications,
      target:  'notifications',
      partial: 'books/blah',
      locals:  { book: book, counter: counter, qdp: query_doc_pair, judge: judge }
    )
  end

  def broadcast_update_kraken_mode book, counter, query_doc_pair, judge
    Turbo::StreamsChannel.broadcast_render_to(
      :notifications,
      target:  'notifications',
      partial: 'books/update_kraken_mode',
      locals:  { book: book, counter: counter, qdp: query_doc_pair, judge: judge }
    )
  end

  def broadcast_complete book, judge
    Turbo::StreamsChannel.broadcast_render_to(
      :notifications,
      target:  'notifications',
      partial: 'books/complete',
      locals:  { book: book, judge: judge }
    )
    Turbo::StreamsChannel.broadcast_update_to(
      book.judgements_broadcast_channel,
      target:  "judging-activity-#{judge.id}",
      partial: 'books/judging_activity_complete',
      locals:  { book: book, judge: judge }
    )
  end
end
