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

  let(:javascript_scorer) do
    JavascriptScorer.new(Rails.root.join('lib/scorer_logic.js'))
  end

  describe 'p@10' do
    describe 'when score data is invalid' do
      let(:the_case) { cases(:case_without_score) }

      test 'runs even though no scores provided' do
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
    let(:scorer_code) do
      File.read('db/scorers/ap@10.js')
    end
    test 'runs simple' do
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

    test 'situation produces NaN' do
      # Need David Fisher help here.  Why am I getting NaN?
      # Going to just make it return a 0 in FetchService

      docs = [ { :id => '77383738', :rating => 0.0 },
               { :id => '77502729', :rating => 0.0 },
               { :id => '77031393', :rating => 0.0 },
               { :id => '78106266', :rating => 0.0 } ]

      best_docs = [ { :id => '77193049', :rating => 0.0 },
                    { :id => '77031393', :rating => 0.0 },
                    { :id => '2120998', :rating => 0.0 } ]

      score = javascript_scorer.score(docs, best_docs, scorer_code)
      assert score.nan?
    end
  end

  describe 'cg@10' do
    let(:the_case) { cases(:case_without_score) }

    test 'runs simple' do
      scorer_code = File.read('db/scorers/cg@10.js')

      # order matters!
      docs = [
        { id: 1, rating: 0 },
        { id: 2, rating: 3 },
        { id: 3, rating: 1 }
      ]

      best_docs = []

      score = javascript_scorer.score(docs, best_docs, scorer_code)
      assert_equal 4, score
    end
  end

  describe 'dcg@10' do
    let(:the_case) { cases(:case_without_score) }

    test 'runs simple' do
      scorer_code = File.read('db/scorers/dcg@10.js')

      # order matters!
      docs = [
        { id: 1, rating: 0 },
        { id: 2, rating: 3 },
        { id: 3, rating: 1 }
      ]

      best_docs = []

      score = javascript_scorer.score(docs, best_docs, scorer_code)
      assert_equal 4.92, score
    end
  end

  describe 'ndcg@10' do
    let(:the_case) { cases(:case_without_score) }

    test 'runs simple' do
      scorer_code = File.read('db/scorers/ndcg@10.js')

      # order matters!
      docs = [
        { id: 1, rating: 0 },
        { id: 2, rating: 3 },
        { id: 3, rating: 1 }
      ]

      # order matters!
      best_docs = [
        { id: 2, rating: 3 },
        { id: 3, rating: 1 },
        { id: 1, rating: 0 }
      ]

      score = javascript_scorer.score(docs, best_docs, scorer_code)
      assert_equal 0.64, score
    end
  end
  describe 'rr@10' do
    let(:the_case) { cases(:case_without_score) }

    test 'runs simple' do
      scorer_code = File.read('db/scorers/rr@10.js')

      # order matters!
      docs = [
        { id: 1, rating: 0 },
        { id: 2, rating: 0 },
        { id: 3, rating: 1 }
      ]

      best_docs = []

      score = javascript_scorer.score(docs, best_docs, scorer_code)
      assert_equal 0.33, score
    end
  end

  describe 'recency scorer' do
    let(:the_case) { cases(:case_without_score) }

    test 'runs simple and tests eachDoc w/ a function' do
      scorer_code = <<-STRING.dup
        const k = 10; // @Rank
        let rank = 0;
        let score = 0;
        baseDate = new Date("2023-08-15").getTime();
        eachDoc(function(doc, i) {
          docDate = doc['publish_date'];
          const diffTime = (baseDate - new Date(docDate).getTime());
          const diff = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          score = score + diff;
          rank = rank + 1
        }, k);
        score = rank > 0 ? score / rank : 0.0;
        setScore(score);
      STRING

      # order matters!
      docs = [
        { id: 1, rating: 0, publish_date: '2023-08-13' },
        { id: 2, rating: 0, publish_date: '2023-08-13' },
        { id: 3, rating: 1, publish_date: '2023-08-14' }
      ]

      best_docs = []

      score = javascript_scorer.score(docs, best_docs, scorer_code)
      assert_equal 1.67, score
    end
  end
end
