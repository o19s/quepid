# frozen_string_literal: true

class RunJudgeJudyJob < ApplicationJob
  queue_as :default

  # Finds the in-flight (not finished) SolidQueue rows for this job class
  # matching the given book + judge. This is the one place that reaches into
  # SolidQueue's serialized arguments to answer "is this book+judge combo
  # actively being judged right now" - callers (the book overview page, the
  # cancel action, the live broadcast) should use this or #actively_judging?
  # rather than re-deriving it.
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

  def self.actively_judging? book, judge
    active_for(book, judge).any?
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

        judge_gid_arg = args.find { |a| a.is_a?(Hash) && a['_aj_globalid']&.include?('/User/') }
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

      llm_service.perform_safe_judgement(judgement)

      # if we don't have a rating, let's assume it's not rateable and mark it so.
      judgement.mark_unrateable if judgement.rating.blank?

      judgement.save!
      counter += 1
      BroadcastJudgeActivityJob.perform_later(book, judge)
      broadcast_judging_detail(book, judge, query_doc_pair, counter, judgement)

      if number_of_pairs.nil?
        broadcast_update_kraken_mode(book, counter, query_doc_pair, judge)
      else
        broadcast_update(book, number_of_pairs - counter, query_doc_pair, judge)
      end
    end
    broadcast_complete(book, judge)
    BroadcastJudgeActivityJob.perform_later(book, judge, actively_judging: false)
    UpdateCaseJob.perform_later book
  end

  private

  def broadcast_judging_detail book, judge, qdp, counter, judgement
    Turbo::StreamsChannel.broadcast_update_to(
      "book_#{book.id}_judgements",
      target:  "judging-activity-#{judge.id}",
      partial: 'books/judging_activity_detail',
      locals:  { book: book, judge: judge, qdp: qdp, counter: counter, judgement: judgement }
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
      "book_#{book.id}_judgements",
      target:  "judging-activity-#{judge.id}",
      partial: 'books/judging_activity_complete',
      locals:  { book: book, judge: judge }
    )
  end
end
