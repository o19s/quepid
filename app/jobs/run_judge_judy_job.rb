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
  #
  # @example Judge 10 pairs
  #   RunJudgeJudyJob.perform_later(book, ai_judge, 10)
  #
  # @example Judge all pairs
  #   RunJudgeJudyJob.perform_later(book, ai_judge, nil)
  def perform book, judge, number_of_pairs
    counter = 0
    total_pairs = book.query_doc_pairs_within_rank_depth.count
    llm_service = LlmService.new judge.llm_key, judge.judge_options
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
      break if cancellable && !SolidQueue::Job.exists?(active_job_id: job_id)

      query_doc_pair = SelectionStrategy.random_query_doc_based_on_strategy(book, judge)
      break if query_doc_pair.nil?

      judgement = Judgement.new(query_doc_pair: query_doc_pair, user: judge)

      llm_service.perform_safe_judgement(judgement, book: book)
      JudgementFinalizer.call(judgement, book: book)

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
  end

  private

  # If we don't have a rating, assume it's not rateable and mark it so. If the
  # LLM returned a rating outside this book's configured scale -- a human
  # judge could never produce this (the judging UI only offers buttons for
  # the book's actual scale values) -- don't trust it, but keep the raw value
  # visible for review rather than silently dropping it. (A book with no
  # scale configured at all is left alone here -- there's nothing to
  # validate against, so its rating passes through as-is.)
  def mark_unrateable_if_invalid judgement, book
    if judgement.rating.blank?
      judgement.mark_unrateable
    elsif book.scale.present? && book.scale.map(&:to_f).exclude?(judgement.rating.to_f)
      judgement.explanation = "#{judgement.explanation} [LLM returned rating #{judgement.rating.inspect}, outside this book's scale #{book.scale.inspect}]".strip
      judgement.mark_unrateable
    end
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
