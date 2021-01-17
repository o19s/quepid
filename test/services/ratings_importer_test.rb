# frozen_string_literal: true

require 'test_helper'

class RatingsImporterTest < ActiveSupport::TestCase
  let(:owned_case) { cases(:owned_case) }
  let(:options)    do
    {
      format:         :hash,
      force:          true,
      clear_existing: true,
    }
  end

  describe 'Import ratings' do
    test 'strips white space in values' do
      ratings = [
        { query_text: 'Mexican Food',   doc_id: ' 720784-021190', rating: ' 5' },
        { query_text: 'Mexican Food',   doc_id: ' 843075-031090', rating: ' 6' },
        { query_text: ' Mexican Food ', doc_id: '748785-005680',  rating: ' 2' }
      ]

      ratings_importer = RatingsImporter.new owned_case, ratings, options
      ratings_importer.import
      rating = Rating.find_by(doc_id: '843075-031090')

      assert_not_nil(rating)
      assert_equal 'Mexican Food', rating.query.query_text
    end

    test 'includes queries with no ratings as queries but no ratings' do
      ratings = [
        { query_text: 'Mexican Food', doc_id: '720784-021190', rating: '5' },
        { query_text: 'Mexican Food', doc_id: '843075-031090', rating: '' },
        { query_text: 'Mexican Food', doc_id: '748785-005680', rating: nil }
      ]

      ratings_importer = RatingsImporter.new owned_case, ratings, options
      ratings_importer.import

      rating = Rating.find_by(doc_id: '720784-021190')
      assert_not_nil rating
      assert_equal 'Mexican Food', rating.query.query_text

      rating = Rating.find_by(doc_id: '843075-031090')
      assert_nil rating
      rating = Rating.find_by(doc_id: '748785-005680')
      assert_nil rating
      query = Query.find_by(case_id: owned_case.id, query_text: 'Mexican Food')
      assert_not_nil query
    end

    test 'includes queries with no ratings and no docs as queries but no ratings' do
      ratings = [
        { query_text: 'Mexican Food', doc_id: '720784-021190', rating: '5' },
        { query_text: 'Mexican Food', doc_id: '', rating: '' },
        { query_text: 'Chinese Food', doc_id: nil, rating: nil }
      ]

      assert_empty owned_case.queries

      ratings_importer = RatingsImporter.new owned_case, ratings, options
      ratings_importer.import

      owned_case.reload
      rating = Rating.find_by(doc_id: '720784-021190')

      assert_not_nil rating
      assert_equal 'Mexican Food', rating.query.query_text

      assert_equal 2, owned_case.queries.size
      query = Query.find_by(case_id: owned_case.id, query_text: 'Chinese Food')
      assert_empty query.ratings

      query = Query.find_by(case_id: owned_case.id, query_text: 'Mexican Food')
      assert_equal 1, query.ratings.size
    end

    test 'converts strings to symbols' do
      ratings = [
        { 'query_text': 'Mexican Food',   'doc_id': ' 920784-021190', 'rating': ' 5' },
        { 'query_text': 'Mexican Food',   'doc_id': ' 943075-031090', 'rating': ' 6' },
        { 'query_text': 'Indian Food ',   'doc_id': '948785-005680',  'rating': ' 2' }
      ]

      ratings_importer = RatingsImporter.new owned_case, ratings, options
      ratings_importer.import
      owned_case.reload

      rating = Rating.find_by(doc_id: '943075-031090')
      assert_not_nil(rating)

      rating = Rating.find_by(doc_id: '920784-021190')
      assert_not_nil rating
      assert_equal 'Mexican Food', rating.query.query_text

      assert_equal 2, owned_case.queries.size
      query = Query.find_by(case_id: owned_case.id, query_text: 'Indian Food')
      assert_equal 1, query.ratings.size

      query = Query.find_by(case_id: owned_case.id, query_text: 'Mexican Food')
      assert_equal 2, query.ratings.size
    end
  end

  test 'handles when a doc id does not exist in our index, it is still inserted' do
    ratings = [
      { query_text: 'Swedish Food',   doc_id: ' 720784-021190', rating: nil },
      { query_text: 'Swedish Food',   doc_id: 'NON_EXISTANT_DOC_ID', rating: '6' }
    ]

    ratings_importer = RatingsImporter.new owned_case, ratings, options
    ratings_importer.import
    rating = Rating.find_by(doc_id: '720784-021190')
    assert_nil(rating)

    rating = Rating.find_by(doc_id: 'NON_EXISTANT_DOC_ID')
    assert_not_nil(rating)
    assert_equal 'Swedish Food', rating.query.query_text
  end
end
