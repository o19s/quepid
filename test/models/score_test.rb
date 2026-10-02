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
#  support_last_score                    (updated_at,created_at,id)
#
# Foreign Keys
#
#  case_scores_ibfk_1  (case_id => cases.id)
#  case_scores_ibfk_2  (user_id => users.id)
#  fk_rails_...        (annotation_id => annotations.id)
#

require 'test_helper'

class ScoreTest < ActiveSupport::TestCase
  test 'latest summaries return one score per requested case without query payloads' do
    case_ids = [ cases(:one).id, cases(:other_score_case).id ]
    expected_ids = case_ids.map { |id| Case.find(id).last_score.id }

    summaries = Score.latest_summaries_for_cases(case_ids).to_a

    assert_equal expected_ids.sort, summaries.map(&:id).sort
    summaries.each do |summary|
      assert_not summary.has_attribute?(:queries)
      assert_predicate summary.association(:user), :loaded?
      assert_equal summary.user_id, summary.user.id
    end
  end

  test 'latest summaries use updated_at then created_at then id including annotated scores' do
    kase = cases(:other_score_case)
    timestamp = Time.current.change(usec: 0)
    kase.scores.update_all(updated_at: timestamp, created_at: timestamp - 1.day)
    oldest, middle, newest = kase.scores.reorder(:id).to_a

    oldest.update_columns(created_at: timestamp)
    assert_equal [ oldest.id ], Score.latest_summaries_for_cases([ kase.id ]).map(&:id)

    middle.update_columns(created_at: timestamp)
    assert_equal [ middle.id ], Score.latest_summaries_for_cases([ kase.id ]).map(&:id)

    newest.update_columns(updated_at: timestamp + 1.second)
    assert_equal [ newest.id ], Score.latest_summaries_for_cases([ kase.id ]).map(&:id)

    annotated = scores(:score_with_annotation)
    annotated.update_columns(updated_at: timestamp + 2.seconds)
    assert_equal [ annotated.id ], Score.latest_summaries_for_cases([ kase.id ]).map(&:id)
  end

  test 'latest summaries handle an empty page and cases without scores' do
    assert_empty Score.latest_summaries_for_cases([])
    assert_empty Score.latest_summaries_for_cases([ cases(:two).id ])
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
