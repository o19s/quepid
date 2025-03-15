# frozen_string_literal: true

class RunJudgeJudyJob < ApplicationJob
  queue_as :default

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
  # rubocop:disable Metrics/MethodLength
  def perform book, judge, number_of_pairs
    counter = 0
    llm_service = LlmService.new judge.llm_key, judge.judge_options
    loop do
      break if number_of_pairs && counter >= number_of_pairs

      query_doc_pair = SelectionStrategy.random_query_doc_based_on_strategy(book, judge)
      break if query_doc_pair.nil?

      judgement = Judgement.new(query_doc_pair: query_doc_pair, user: judge)

      llm_service.perform_safe_judgement(judgement)

      # if we don't have a rating, let's assume it's not rateable and mark it so.
      judgement.mark_unrateable if judgement.rating.blank?

      judgement.save!
      counter += 1

      if number_of_pairs.nil?
        broadcast_update_kraken_mode(book, counter, query_doc_pair, judge)
      else
        broadcast_update(book, number_of_pairs - counter, query_doc_pair, judge)
      end
    end
    broadcast_complete(book, judge)
    UpdateCaseJob.perform_later book
  end
  # rubocop:enable Metrics/MethodLength

  private

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
  end
end
