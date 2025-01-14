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
  def perform book, judge, number_of_pairs
    counter = 0
    loop do
      break if number_of_pairs && counter >= (number_of_pairs.to_i)

      query_doc_pair = SelectionStrategy.random_query_doc_based_on_strategy(book, judge)
      break if query_doc_pair.nil?

      judgement = Judgement.new(query_doc_pair: query_doc_pair, user: judge, updated_at: Time.zone.now)
      judgement.rating = 4
      judgement.explanation = "Eric writing code.  Judge is #{judge.email}"
      judgement.save!
      sleep 1
      broadcast_update(book, counter += 1, query_doc_pair, judge)
    end
    UpdateCaseJob.perform_later book
  end

  private

  def broadcast_update book, counter, query_doc_pair, judge
    Turbo::StreamsChannel.broadcast_render_to(
      :notifications,
      target:  'notifications',
      partial: 'books/blah',
      locals:  { book: book, counter: counter, qdp: query_doc_pair, judge: judge }
    )
  end
end
