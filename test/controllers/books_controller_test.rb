# frozen_string_literal: true

require 'test_helper'

class BooksControllerTest < ActionDispatch::IntegrationTest
  let(:user) { users(:random) }
  let(:book) { books(:james_bond_movies) }
  let(:book_of_comedy_films) { books(:book_of_comedy_films) }
  
  def test_login
    # get the login page
    get "/books"
    assert_equal 302, status
    follow_redirect!

    # post the login and follow through to the home page
    post "/users/login", params: { user: { email: user.email, password: 'password' }}
    follow_redirect!
    assert_equal 200, status
    assert_equal "/", path
    
    get "/books"
    assert_equal 200, status
    
    patch "/books/#{book.id}/combine", params: { book_ids: {"#{book_of_comedy_films.id}":"1"}}
    follow_redirect!
    assert_equal 'ok', flash[:notice]
    
    
  end
end
