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
#  try_id        :integer
#  user_id       :integer
#
# Indexes
#
#  case_id                          (case_id)
#  index_case_scores_annotation_id  (annotation_id) UNIQUE
#  index_case_scores_on_try_id      (try_id)
#  support_last_score               (updated_at,created_at,id)
#  try_id                           (try_id)
#  user_id                          (user_id)
#
# Foreign Keys
#
#  case_scores_ibfk_1  (case_id => cases.id)
#  case_scores_ibfk_2  (user_id => users.id)
#  fk_rails_...        (annotation_id => annotations.id)
#

require 'test_helper'

class ScoreTest < ActiveSupport::TestCase
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
end
