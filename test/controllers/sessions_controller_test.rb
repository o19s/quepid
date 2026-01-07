# frozen_string_literal: true

require 'test_helper'

class SessionsControllerTest < ActionController::TestCase
  test 'should create session for valid user' do
    post :create, params: { user: { email: 'doug@example.com', password: 'password' }, format: :json }
    assert_response :success
    assert_not_nil session[:current_user_id], 'sets a user'
    assert_equal session[:current_user_id], User.find_by(email: 'doug@example.com').id, 'user is doug'
  end

  test 'should not create session for invalid password' do
    post :create, params: { user: { email: 'doug@example.com', password: 'incorrect' }, format: :json }
    assert_response :unprocessable_entity
    assert_nil session[:current_user_id], 'does not set a user'
  end

  test 'should not create session for invalid password html' do
    post :create, params: { user: { email: 'doug@example.com', password: 'incorrect' }, format: :html }
    assert_response :success

    assert_template 'sessions/new'

    alert_message_template = 'Unknown email/password combo. Double check you have the correct email address and password, or sign up for a new account.'
    alert_message = css_select('#error_explanation .alert').text.strip
    assert_equal alert_message_template, alert_message
    assert_nil session[:current_user_id], 'does not set a user'
  end

  test 'should not create session for unknown user' do
    post :create, params: { user: { email: 'floyd@example.com', password: 'floydster' }, format: :json }
    assert_response :unprocessable_entity
  end

  test 'increments the number of logins for the user' do
    user = users(:random)
    user.num_logins = original_number = 1
    user.save

    post :create, params: { user: { email: user.email, password: 'password' }, format: :json }
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
      post :create, params: { user: { email: user.email, password: 'password' }, format: :json }

      assert_response :unprocessable_entity
      assert_equal 'LOCKED', response.parsed_body['reason']
    end
  end

  describe 'email case insensitive' do
    let(:user) { users(:random) }

    before do
      @controller = SessionsController.new
    end

    it 'ignore case for email' do
      post :create, params: { user: { email: user.email.upcase, password: 'password' }, format: :json }

      assert_response :success
      assert_not_nil session[:current_user_id], 'sets a user'
    end
  end
end
