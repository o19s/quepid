# frozen_string_literal: true

class RunJudgeJudyJob < ApplicationJob
  queue_as :default

  def perform book, judge
    loop do
      query_doc_pair = SelectionStrategy.random_query_doc_based_on_strategy(book, judge)
      break if query_doc_pair.nil?

      judgement = Judgement.new(query_doc_pair: query_doc_pair, user: judge, updated_at: Time.zone.now)
      judgement.rating = 4
      judgement.explanation = "Eric writing code.  Judge is #{judge.email}"
      judgement.save!
    end
    UpdateCaseJob.perform_later book
  end
end
