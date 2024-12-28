# frozen_string_literal: true

require 'test_helper'

class JavascriptScorerTest < ActiveSupport::TestCase
  let(:score_data) do
    {
      all_rated:  [ true, false ].sample,
      queries:    {},
      score:      (1..100).to_a.sample,
      try_number: the_try.try_number,
      user_id:    user.id,
    }
  end

  describe 'p@10' do
    describe 'when score data is invalid' do
      let(:the_case) { cases(:case_without_score) }

      test 'runs even though no scores provided' do
        javascript_scorer = JavascriptScorer.new(Rails.root.join('db/scorers/scoring_logic.js'))

        scorer_code = File.read('db/scorers/p@10.js')

        docs = [
          { id: 1 },
          { id: 2 }
        ]
        best_docs = []

        score = javascript_scorer.score(docs, best_docs, scorer_code)
        assert_equal 0.0, score

        # Calculate score with options
        # error = assert_raises(JavascriptScorer::ScoreError) do
        #   javascript_scorer.score(items, Rails.root.join('db/scorers/p@10.js'))
        # end
        # assert_match(/expected error message/, error.message)
      end
    end

    describe 'calculation' do
      test 'runs simple' do
        javascript_scorer = JavascriptScorer.new(Rails.root.join('db/scorers/scoring_logic.js'))
        scorer_code = File.read('db/scorers/p@10.js')
        docs = [
          { id: 1, rating: 1 },
          { id: 2, rating: 0 }
        ]
        best_docs = []
        score = javascript_scorer.score(docs, best_docs, scorer_code)
        assert_equal 0.5, score
      end
    end
  end

  describe 'ap@10' do
    let(:the_case) { cases(:case_without_score) }

    test 'runs simple' do
      javascript_scorer = JavascriptScorer.new(Rails.root.join('db/scorers/scoring_logic.js'))
      scorer_code = File.read('db/scorers/ap@10.js')

      # order matters!
      docs = [
        { id: 1, rating: 0 },
        { id: 2, rating: 1 }
      ]

      # Can be in any order
      best_docs = [
        { id: 2, rating: 1 },
        { id: 1, rating: 0 },
        { id: 3, rating: 1 }
      ]

      score = javascript_scorer.score(docs, best_docs, scorer_code)
      assert_equal 0.25, score
    end
  end
end
