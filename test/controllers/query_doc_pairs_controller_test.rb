# frozen_string_literal: true

require 'test_helper'

class QueryDocPairsControllerTest < ActionDispatch::IntegrationTest
  let(:user) { users(:doug) }
  let(:book) { books(:james_bond_movies) }
  let(:query_doc_pair) { query_doc_pairs(:jbm_qdp1) }

  setup do
    login_user_for_integration_test user
  end

  describe 'GET index' do
    test 'lists the query_doc_pairs for the book' do
      get book_query_doc_pairs_url(book)

      assert_response :success
      assert_equal book.query_doc_pairs.count, assigns(:query_doc_pairs).size
    end

    test 'filters by the q param across query text and doc id' do
      get book_query_doc_pairs_url(book), params: { q: 'Moonraker' }

      assert_response :success
      assert_equal [ query_doc_pairs(:jbm_qdp10) ], assigns(:query_doc_pairs).to_a
    end
  end

  describe 'GET show' do
    test 'renders a single query_doc_pair' do
      get book_query_doc_pair_url(book, query_doc_pair)

      assert_response :success
      assert_equal query_doc_pair, assigns(:query_doc_pair)
    end
  end

  describe 'GET new' do
    test 'builds a new unsaved query_doc_pair' do
      get new_book_query_doc_pair_url(book)

      assert_response :success
      assert_predicate assigns(:query_doc_pair), :new_record?
    end
  end

  describe 'GET edit' do
    test 'renders the edit form for the query_doc_pair' do
      get edit_book_query_doc_pair_url(book, query_doc_pair)

      assert_response :success
    end
  end

  describe 'POST create' do
    test 'adds a new query_doc_pair to the book and redirects to it' do
      assert_difference 'book.query_doc_pairs.count', 1 do
        post book_query_doc_pairs_url(book), params: {
          query_doc_pair: { query_text: 'new query', doc_id: 'new_doc', position: 1 },
        }
      end

      created = book.query_doc_pairs.find_by(query_text: 'new query', doc_id: 'new_doc')
      assert_not_nil created
      assert_redirected_to book_query_doc_pairs_path(book, created)
    end

    test 're-renders new when the query_doc_pair (and so the book) fails to save' do
      assert_no_difference 'QueryDocPair.count' do
        post book_query_doc_pairs_url(book), params: {
          query_doc_pair: { query_text: 'new query', doc_id: '', position: 1 },
        }
      end

      assert_response :success
    end
  end

  describe 'PATCH update' do
    test 'updates the query_doc_pair and redirects to it' do
      patch book_query_doc_pair_url(book, query_doc_pair), params: {
        query_doc_pair: { query_text: 'Updated Query Text' },
      }

      assert_redirected_to book_query_doc_pairs_path(book, query_doc_pair)
      assert_equal 'Updated Query Text', query_doc_pair.reload.query_text
    end
  end

  describe 'DELETE destroy' do
    test 'removes the query_doc_pair and redirects back to the book' do
      assert_difference 'book.query_doc_pairs.count', -1 do
        delete book_query_doc_pair_url(book, query_doc_pair)
      end

      assert_redirected_to book_path(book)
    end
  end

  describe 'a book this user cannot access' do
    let(:other_users_book) { books(:empty_book_2) }

    test 'renders a JSON 404 instead of a book owned by someone else' do
      get book_query_doc_pairs_url(other_users_book)

      assert_response :not_found
      assert_equal 'Book not found!', response.parsed_body['message']
    end
  end
end
