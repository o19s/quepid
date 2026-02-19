# frozen_string_literal: true

require 'test_helper'

class QueryDocPairsControllerTest < ActionDispatch::IntegrationTest
  before do
    @user = users(:random)
    login_user_for_integration_test @user
  end

  describe 'authorization' do
    it 'returns 404 when accessing a query_doc_pair from a different book via URL manipulation' do
      # random user has access to james_bond_movies (via shared team)
      accessible_book = books(:james_bond_movies)

      # book_of_comedy_qdp1 belongs to book_of_comedy_films, a different book
      pair_in_other_book = query_doc_pairs(:book_of_comedy_qdp1)

      # Try to access a pair from another book by passing the accessible book_id
      # but the other book's pair id — should get 404
      get book_query_doc_pair_path(accessible_book, pair_in_other_book)

      assert_response :not_found
    end

    it 'allows accessing a query_doc_pair that belongs to the correct book' do
      accessible_book = books(:james_bond_movies)
      pair = query_doc_pairs(:jbm_qdp1)

      get book_query_doc_pair_path(accessible_book, pair)

      assert_response :success
    end
  end
end
