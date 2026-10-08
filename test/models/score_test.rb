# frozen_string_literal: true

# == Schema Information
#
# Table name: case_scores
#
#  id            :integer          not null, primary key
#  all_rated     :boolean
#  queries       :binary(16777215)
#  score         :float(24)
#  created_at    :datetime
#  updated_at    :datetime
#  annotation_id :integer
#  case_id       :integer
#  scorer_id     :bigint
#  try_id        :integer
#  user_id       :integer
#
# Indexes
#
#  index_case_scores_annotation_id       (annotation_id) UNIQUE
#  index_case_scores_on_case_and_latest  (case_id,updated_at,created_at,id)
#  index_case_scores_on_case_id          (case_id)
#  index_case_scores_on_scorer_id        (scorer_id)
#  index_case_scores_on_user_id          (user_id)
#
# Foreign Keys
#
#  case_scores_ibfk_1  (case_id => cases.id)
#  case_scores_ibfk_2  (user_id => users.id)
#  fk_rails_...        (annotation_id => annotations.id)
#

require 'test_helper'

class ScoreTest < ActiveSupport::TestCase
  test 'latest summaries omit history and query payloads with deterministic tie breakers' do
    kase = cases(:one)
    kase.scores.delete_all
    timestamp = Time.utc(2020, 1, 1)
    kase.scores.create!(score: 0.1, created_at: timestamp, updated_at: timestamp)
    winner = kase.scores.create!(user: users(:doug), score: 0.8, queries: { 'large' => 'payload' },
                                 created_at: timestamp, updated_at: timestamp)
    records = Score.latest_summaries_for_cases([ kase.id, cases(:two).id ]).to_a
    summary = records.find { |record| record.case_id == kase.id }

    assert_equal winner.id, summary.id
    assert_in_delta 0.8, summary.score
    assert_not summary.has_attribute?(:queries)
    assert_predicate summary.association(:user), :loaded?
    assert_equal users(:doug), summary.user
    assert_empty Score.latest_summaries_for_cases([])
  end

  describe 'serialize queries scores' do
    let(:score)               { scores(:score) }
    let(:score_with_queries)  { scores(:score_with_queries) }

    it 'saves a hash of queries scores' do
      score.queries = {
        '1' => {
          text:  'first query',
          score: 1,
        },
        '2' => {
          text:  'second query',
          score: 9,
        },
      }

      score.save

      assert_not_nil score.queries
    end

    it 'returns queries scores as a hash' do
      assert_instance_of Hash, score_with_queries.queries
    end
  end

  describe '.sampled' do
    let(:kase) { cases(:one) }

    it 'accepts decimal strings and a zero sample' do
      assert_equal 5, Score.sampled(kase.id.to_s, '5').count
      assert_empty Score.sampled(kase.id, 0)
    end

    it 'rejects SQL fragments and noninteger arguments' do
      [ nil, -1, 1.5, '1 OR 1=1', '1; DROP TABLE case_scores' ].each do |invalid|
        assert_raises(ArgumentError) { Score.sampled(invalid, 5) }
        assert_raises(ArgumentError) { Score.sampled(kase.id, invalid) }
      end
    end

    it 'returns the requested number of scores for the case' do
      # fixtures give case :one 11 scores (one + valid_1..valid_10)
      sampled = Score.sampled(kase.id, 5)

      assert_equal 5, sampled.count
      assert(sampled.all? { |score| score.case_id == kase.id })
    end

    it 'returns every score for the case when the sample size exceeds the total' do
      sampled = Score.sampled(kase.id, 100)

      assert_equal kase.scores.count, sampled.count
    end
  end
end
