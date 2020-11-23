# frozen_string_literal: true

require 'test_helper'

class SessionsControllerTest < ActionController::TestCase
  test 'should create session for valid user' do
    post :create, params: { email: 'doug@example.com', password: 'password', format: :json }
    assert_response :success
    assert_not_nil session[:current_user_id], 'sets a user'
    assert session[:current_user_id] == User.find_by(email: 'doug@example.com').id, 'user is doug'
  end

  test 'should not create session for invalid password' do
    post :create, params: { email: 'doug@example.com', password: 'incorrect', format: :json }
    assert_response :unprocessable_entity
    assert_nil session[:current_user_id], 'does not set a user'
  end

  test 'should not create session for unknown user' do
    post :create, params: { email: 'floyd@example.com', password: 'floydster', format: :json }
    assert_response :unprocessable_entity
  end

  test 'increments the number of logins for the user' do
    user = users(:random)
    user.num_logins = original_number = 1
    user.save

    post :create, params: { email: user.email, password: 'password', format: :json }
    assert_response :success

    user.reload
    assert_equal user.num_logins, original_number + 1
  end

  describe 'locked user' do
    let(:user) { users(:locked_user) }

    before do
      @controller = SessionsController.new
    end

    it 'rejects the user when trying to log in' do
      post :create, params: { email: user.email, password: 'password', format: :json }

      assert_response :unprocessable_entity
      assert_equal 'LOCKED', json_response['reason']
    end
  end

  describe 'email case insensitive' do
    let(:user) { users(:random) }

    before do
      @controller = SessionsController.new
    end

    it 'ignore case for email' do
      post :create, params: { email: user.email.upcase, password: 'password', format: :json }

      assert_response :success
      assert_not_nil session[:current_user_id], 'sets a user'
    end
  end
end
