# frozen_string_literal: true

# == Schema Information
#
# Table name: case_scores
#
#  id            :integer          not null, primary key
#  case_id       :integer
#  user_id       :integer
#  try_id        :integer
#  score         :float(24)
#  all_rated     :boolean
#  created_at    :datetime
#  queries       :binary(16777215)
#  annotation_id :integer
#  updated_at    :datetime
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
