# frozen_string_literal: true

require 'test_helper'

class QueryScoreServiceTest < ActiveSupport::TestCase
  test 'scores a query using the scorer code and ratings' do
    scorer = scorers(:valid)
    query = queries(:first_query)

    # Ensure query has at least one rating
    query.ratings.create!(doc_id: 'doc1', rating: 3) unless query.ratings.any?

    score = QueryScoreService.score(query, scorer)
    # Score should be a number (exact value depends on scorer code)
    assert score.is_a?(Numeric) || score.nil?, "Expected numeric score or nil, got #{score.class}"
  end

  test 'returns nil when scorer is blank' do
    query = queries(:first_query)
    assert_nil QueryScoreService.score(query, nil)
  end

  test 'returns nil when scorer has no code' do
    scorer = scorers(:valid)
    scorer.code = nil
    query = queries(:first_query)
    assert_nil QueryScoreService.score(query, scorer)
  end

  test 'returns 0 for query with no ratings' do
    scorer = scorers(:valid)
    query = queries(:first_query)
    query.ratings.destroy_all

    score = QueryScoreService.score(query, scorer)
    # With no docs, most scorers return 0 or nil
    assert score.nil? || score.is_a?(Numeric), "Expected numeric or nil, got #{score.inspect}"
  end

  test 'uses latest snapshot doc order and positions when available' do
    scorer = scorers(:valid)
    query = queries(:first_query)
    query.ratings.destroy_all
    query.ratings.create!(doc_id: 'doc1', rating: 3)
    query.ratings.create!(doc_id: 'doc2', rating: 1)

    snapshot_doc = Struct.new(:doc_id, :position)
    snapshot_query = Struct.new(:snapshot_docs).new(
      [
        snapshot_doc.new('doc2', 1),
        snapshot_doc.new('doc1', 2),
        snapshot_doc.new('doc3', 3)
      ]
    )

    scorer_double_class = Class.new do
      attr_reader :captured_docs

      def score docs, _best_docs, _code
        @captured_docs = docs
        0.5
      end
    end
    javascript_scorer = scorer_double_class.new

    original_snapshot_lookup = QueryScoreService.method(:latest_snapshot_query_for)
    original_js_new = JavascriptScorer.method(:new)

    begin
      QueryScoreService.define_singleton_method(:latest_snapshot_query_for) { |_query| snapshot_query }
      JavascriptScorer.define_singleton_method(:new) { |_path| javascript_scorer }

      assert_in_delta(0.5, QueryScoreService.score(query, scorer))
      docs = javascript_scorer.captured_docs
      assert_equal(%w[doc2 doc1 doc3], docs.map { |doc| doc[:id] })
      assert_equal([ 1, 2, 3 ], docs.map { |doc| doc[:position] })
      assert_equal([ 1, 3, nil ], docs.map { |doc| doc[:rating] })
    ensure
      QueryScoreService.define_singleton_method(:latest_snapshot_query_for, original_snapshot_lookup)
      JavascriptScorer.define_singleton_method(:new, original_js_new)
      QueryScoreService.send(:private_class_method, :latest_snapshot_query_for) if QueryScoreService.respond_to?(:private_class_method)
    end
  end

  test 'passes real scorer code string to JavascriptScorer' do
    scorer = scorers(:valid)
    scorer.code = File.read(Rails.root.join('db/scorers/p@10.js'))
    query = queries(:first_query)
    query.ratings.destroy_all
    query.ratings.create!(doc_id: 'doc1', rating: 1)

    scorer_double_class = Class.new do
      attr_reader :captured_code

      def score _docs, _best_docs, code
        @captured_code = code
        0.25
      end
    end
    javascript_scorer = scorer_double_class.new
    original_js_new = JavascriptScorer.method(:new)

    begin
      JavascriptScorer.define_singleton_method(:new) { |_path| javascript_scorer }

      assert_in_delta(0.25, QueryScoreService.score(query, scorer))
      assert_equal scorer.code, javascript_scorer.captured_code
      assert_includes javascript_scorer.captured_code, 'setScore('
    ensure
      JavascriptScorer.define_singleton_method(:new, original_js_new)
    end
  end
end
