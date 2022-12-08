# frozen_string_literal: true

require 'test_helper'

class QueryDocPairsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @query_doc_pair = query_doc_pairs(:one)
  end

  test 'should get index' do
    get query_doc_pairs_url
    assert_response :success
  end

  test 'should get new' do
    get new_query_doc_pair_url
    assert_response :success
  end

  test 'should create query_doc_pair' do
    assert_difference('QueryDocPair.count') do
      post query_doc_pairs_url,
           params: { query_doc_pair: {
             book_id:         @query_doc_pair.book_id,
             document_fields: @query_doc_pair.document_fields,
             query_text:      @query_doc_pair.query_text,
             position:        @query_doc_pair.position,
             user_id:         @query_doc_pair.user_id,
           } }
    end

    assert_redirected_to query_doc_pair_url(QueryDocPair.last)
  end

  test 'should show query_doc_pair' do
    get query_doc_pair_url(@query_doc_pair)
    assert_response :success
  end

  test 'should get edit' do
    get edit_query_doc_pair_url(@query_doc_pair)
    assert_response :success
  end

  test 'should update query_doc_pair' do
    patch query_doc_pair_url(@query_doc_pair),
          params: { query_doc_pair: {
            book_id:         @query_doc_pair.book_id,
            document_fields: @query_doc_pair.document_fields,
            query_text:      @query_doc_pair.query_text,
            position:        @query_doc_pair.position,
            user_id:         @query_doc_pair.user_id,
          } }
    assert_redirected_to query_doc_pair_url(@query_doc_pair)
  end

  test 'should destroy query_doc_pair' do
    assert_difference('QueryDocPair.count', -1) do
      delete query_doc_pair_url(@query_doc_pair)
    end

    assert_redirected_to query_doc_pairs_url
  end
end
