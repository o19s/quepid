# frozen_string_literal: true

require 'test_helper'

class BooksControllerTest < ActionDispatch::IntegrationTest
  let(:user) { users(:random) }
  let(:book) { books(:book_of_comedy_films) }
  let(:james_bond_movies) { books(:james_bond_movies) }

  # rubocop:disable Metrics/AbcSize
  # rubocop:disable Metrics/MethodLength
  def test_functionality
    # definitly an opportunity for refactoring!

    # get the login page
    get '/books'
    assert_equal 302, status
    follow_redirect!

    # post the login and follow through to the home page
    post '/users/login', params: { user: { email: user.email, password: 'password' } }
    follow_redirect!
    assert_equal 200, status
    assert_equal '/', path

    get '/books'
    assert_equal 200, status

    patch "/books/#{book.id}/combine", params: { book_ids: { "#{james_bond_movies.id}": '1' } }
    follow_redirect!
    assert_equal 'ok.  Combined 7 query/doc pairs.', flash[:notice]

    book.reload
    assert_equal book.query_doc_pairs.count, james_bond_movies.query_doc_pairs.count
    assert_equal book.judgements.count, james_bond_movies.judgements.count

    patch "/books/#{book.id}/combine",
          params: { book_ids: { "#{james_bond_movies.id}": '1', "#{james_bond_movies.id}": '1' } }
    follow_redirect!
    assert_equal 'ok.  Combined 7 query/doc pairs.', flash[:notice]

    book.reload
    assert_equal book.query_doc_pairs.count, james_bond_movies.query_doc_pairs.count
    assert_equal book.judgements.count, james_bond_movies.judgements.count

    patch "/books/#{book.id}/combine", params: { book_ids: { "#{book.id}": '1' } }
    follow_redirect!
    assert_equal 'ok.  Combined 7 query/doc pairs.', flash[:notice]

    book.reload
    assert_equal book.query_doc_pairs.count, 7
  end
  # rubocop:enable Metrics/AbcSize
  # rubocop:enable Metrics/MethodLength
  
  def test_more
    
    
    # post the login and follow through to the home page
    post '/users/login', params: { user: { email: user.email, password: 'password' } }
    follow_redirect!
    assert_equal 200, status
    assert_equal '/', path
    
    assert_equal book.query_doc_pairs.count, 0

    patch "/books/#{book.id}/combine", params: { book_ids: { "#{james_bond_movies.id}": '1' } }
    follow_redirect!
    assert_equal 'ok.  Combined 7 query/doc pairs.', flash[:notice]
    
    assert_equal book.query_doc_pairs.count, 7
  end
end
