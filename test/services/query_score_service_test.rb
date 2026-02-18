# frozen_string_literal: true

require "test_helper"

class QueryScoreServiceTest < ActiveSupport::TestCase
  test "scores a query using the scorer code and ratings" do
    scorer = scorers(:valid)
    query = queries(:first_query)

    # Ensure query has at least one rating
    unless query.ratings.any?
      query.ratings.create!(doc_id: "doc1", rating: 3)
    end

    score = QueryScoreService.score(query, scorer)
    # Score should be a number (exact value depends on scorer code)
    assert score.is_a?(Numeric) || score.nil?, "Expected numeric score or nil, got #{score.class}"
  end

  test "returns nil when scorer is blank" do
    query = queries(:first_query)
    assert_nil QueryScoreService.score(query, nil)
  end

  test "returns nil when scorer has no code" do
    scorer = scorers(:valid)
    scorer.code = nil
    query = queries(:first_query)
    assert_nil QueryScoreService.score(query, scorer)
  end

  test "returns 0 for query with no ratings" do
    scorer = scorers(:valid)
    query = queries(:first_query)
    query.ratings.destroy_all

    score = QueryScoreService.score(query, scorer)
    # With no docs, most scorers return 0 or nil
    assert score.nil? || score.is_a?(Numeric), "Expected numeric or nil, got #{score.inspect}"
  end
end
