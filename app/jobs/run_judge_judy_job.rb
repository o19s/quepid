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
      query_doc_pair = SelectionStrategy.random_query_doc_based_on_strategy(book, judge)
      break if query_doc_pair.nil?
      if number_of_pairs
        break if counter == number_of_pairs
      end

      judgement = Judgement.new(query_doc_pair: query_doc_pair, user: judge, updated_at: Time.zone.now)
      judgement.rating = 4
      judgement.explanation = "Eric writing code.  Judge is #{judge.email}"
      judgement.save!
      counter = counter + 1
    end
    UpdateCaseJob.perform_later book
  end
end
