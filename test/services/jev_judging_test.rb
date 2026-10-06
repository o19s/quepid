# frozen_string_literal: true

require 'test_helper'

class JevJudgingTest < ActiveSupport::TestCase
  let(:judge) { users(:judge_judy) }
  let(:book) { books(:james_bond_movies) }
  let(:url) { 'https://api.typesafe.ai/v1/systemone' }

  setup do
    judge.update!(judge_options: { llm_provider: 'typesafe_jev', llm_service_url: 'https://api.typesafe.ai',
                                  llm_model: 'jev-latest', jev_min_confidence: '0.5' })
  end

  test 'a judging run sends criteria and saves the mapped rating with its explanation' do
    request = stub_request(:post, url).with do |req|
      payload = JSON.parse(req.body)
      assert_equal [ 'Not Relevant', 'Relevant' ], payload.dig('questions', 'relevance', 'criteria')
      assert_kind_of Hash, payload['state']
      true
    end.to_return(status: 200, body: answer(0.8).to_json)

    perform_enqueued_jobs(only: RunJudgeJudyJob) { RunJudgeJudyJob.perform_later(book, judge, 1) }

    judgement = book.judgements.where(user: judge).order(:id).last
    assert_in_delta 1, judgement.rating
    assert_not judgement.unrateable
    assert_includes judgement.explanation, 'Jev rated 1'
    assert_requested request, times: 1
  end

  test 'a low confidence judging run saves an unrateable judgement and keeps the distribution' do
    stub_request(:post, url).to_return(status: 200, body: answer(0.2).to_json)

    perform_enqueued_jobs(only: RunJudgeJudyJob) { RunJudgeJudyJob.perform_later(book, judge, 1) }

    judgement = book.judgements.where(user: judge).order(:id).last
    assert_predicate judgement, :unrateable
    assert_nil judgement.rating
    assert_includes judgement.explanation, 'confidence 0.2'
    assert_includes judgement.explanation, 'Distribution:'
  end

  test 'a missing answer becomes an unrateable judgement rather than terminating the run' do
    stub_request(:post, url).to_return(status: 200, body: { answers: {} }.to_json)

    perform_enqueued_jobs(only: RunJudgeJudyJob) { RunJudgeJudyJob.perform_later(book, judge, 1) }

    judgement = book.judgements.where(user: judge).order(:id).last
    assert_predicate judgement, :unrateable
    assert_includes judgement.explanation, "Jev returned no 'relevance' answer"
  end

  private

  def answer confidence
    { model: 'jev-fixture', answers: { relevance: { type: 'score', score: 0.8, confidence: confidence,
                                                   probabilities: { '0' => 0.2, '1' => 0.8 } } } }
  end
end
