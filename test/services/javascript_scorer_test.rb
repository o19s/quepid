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
    JavascriptScorer.new
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
        assert_in_delta(0.0, score)

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
        assert_in_delta(0.5, score)
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
      assert_in_delta(0.25, score)
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
      assert_predicate score, :nan?
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
      assert_in_delta(4.92, score)
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
      assert_in_delta(0.64, score)
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
      assert_in_delta(0.33, score)
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
      assert_in_delta(1.67, score)
    end
  end

  describe 'helpers shared with the case UI runtime' do
    let(:docs) do
      [
        { id: 1, rating: 3, title: 'first' },
        { id: 2, rating: 0, title: 'second' },
        { id: 3, title: 'unrated' }
      ]
    end
    let(:best_docs) do
      [
        { id: 1, rating: 3 },
        { id: 4, rating: 2 },
        { id: 2, rating: 0 }
      ]
    end

    test 'runs the v1 scorer (avgRating100 and editDistanceFromBest)' do
      score = javascript_scorer.score(docs, best_docs, File.read('db/scorers/v1.js'), scale: [ 0, 1, 2, 3 ])
      assert_equal 48, score
    end

    test 'exposes max from the scorer scale to err@10' do
      score = javascript_scorer.score(docs, best_docs, File.read('db/scorers/err@10.js'), scale: [ 0, 1, 2, 3 ])
      assert_in_delta(0.88, score)
    end

    test 'pass scores 100' do
      assert_equal 100, javascript_scorer.score(docs, best_docs, 'pass()')
    end

    test 'a failed assert raises a ScoreError' do
      assert_raises(JavascriptScorer::ScoreError) do
        javascript_scorer.score(docs, best_docs, 'assert(numReturned() > 5); setScore(1)')
      end
    end

    test 'assertOrScore sets the fallback score' do
      assert_equal 7, javascript_scorer.score(docs, best_docs, 'assertOrScore(false, 7)')
    end

    test 'docAt returns the document fields and unrated docs have no rating' do
      code = 'setScore(docAt(2).title === "unrated" && !hasDocRating(2) && docRating(2) === null ? 1 : 0)'
      assert_equal 1, javascript_scorer.score(docs, best_docs, code)
    end

    test 'numFound, qOption and eachDocWithRatingEqualTo use the query context' do
      code = <<~JS
        let zeros = 0;
        eachDocWithRatingEqualTo(0, function() { zeros++ });
        setScore(numFound() + qOption('bonus') + zeros);
      JS
      score = javascript_scorer.score(docs, best_docs, code, query: { total: 40, options: { bonus: 2 } })
      assert_equal 43, score
    end

    test 'a scorer that never sets a score raises a ScoreError' do
      assert_raises(JavascriptScorer::ScoreError) do
        javascript_scorer.score(docs, best_docs, 'let x = 1')
      end
    end

    test 'a JavaScript error raises a ScoreError' do
      error = assert_raises(JavascriptScorer::ScoreError) do
        javascript_scorer.score(docs, best_docs, 'notAHelper()')
      end
      assert_match(/notAHelper/, error.message)
    end
  end
end
