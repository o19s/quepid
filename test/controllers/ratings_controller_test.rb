# frozen_string_literal: true

require 'test_helper'

class RatingsControllerTest < ActionDispatch::IntegrationTest
  let(:user) { users(:random) }
  setup do
    @case = cases(:import_ratings_case)
  end

  test 'should get index' do
    # get the login page

    get case_ratings_url(@case)
    assert_equal 302, status
    follow_redirect!

    login_user
    get case_ratings_url(@case)
    assert_response :success
  end

  def login_user
    # We don't actually want to load up scores...
    Bullet.enable = false
    # post the login and follow through to the home page
    post '/users/login', params: { user: { email: user.email, password: 'password' } }
    follow_redirect!
    assert_equal 200, status
    assert_equal '/', path

    Bullet.enable = true
  end
end
