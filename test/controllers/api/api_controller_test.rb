# frozen_string_literal: true

require 'test_helper'

module Api
  class ApiControllerTest < ActionController::TestCase
    include Devise::Test::ControllerHelpers

    before do
      @controller = Api::ApiController.new
    end

    describe 'Unauthenticated user' do
      test 'returns unauthorized status when accessing test endpoint' do
        get :test
        assert_response :unauthorized

        body = response.parsed_body
        assert_equal 'Unauthorized!', body['reason']
      end
    end

    describe 'Authenticated user' do
      before do
        login_user users(:doug)
      end

      test 'returns success status when accessing test endpoint' do
        get :test
        assert_response :ok

        body = response.parsed_body
        assert_equal 'Success!', body['message']
      end
    end

    describe 'Authentication with forgery protection enabled' do
      before do
        @previous_forgery_protection = @controller.allow_forgery_protection
        @controller.allow_forgery_protection = true
        @controller.request = @request
      end

      after do
        @controller.allow_forgery_protection = @previous_forgery_protection
      end

      test 'tokenless POST rejects the cached cookie-session user' do
        session[:current_user_id] = users(:doug).id

        post :test

        assert_response :unauthorized
        assert_equal 'Unauthorized!', response.parsed_body['reason']
        assert_nil @controller.current_user
        assert_nil @controller.session[:current_user_id]
      end

      test 'POST with a valid CSRF token retains cookie-session authentication' do
        session[:current_user_id] = users(:doug).id
        token = @controller.send(:form_authenticity_token)

        post :test, params: { authenticity_token: token }

        assert_response :ok
        assert_equal users(:doug), @controller.current_user
      end

      test 'tokenless POST accepts API-key authentication' do
        api_key = ApiKey.create!(user: users(:doug), token: 'csrf-regression-key')
        @request.headers['Authorization'] = ActionController::HttpAuthentication::Token.encode_credentials(api_key.token_digest)

        post :test

        assert_response :ok
        assert_equal users(:doug), @controller.current_user
        assert_equal api_key, @controller.current_api_key
      end

      test 'tokenless POST rejects an invalid API key even with a cookie session' do
        session[:current_user_id] = users(:doug).id
        @request.headers['Authorization'] = ActionController::HttpAuthentication::Token.encode_credentials('invalid-key')

        post :test

        assert_response :unauthorized
        assert_nil @controller.current_api_key
        assert_nil @controller.session[:current_user_id]
      end
    end

    describe 'Quepid Qonfiguration' do
      test 'signup is enabled' do
        assert_predicate @controller, :signup_enabled?
      end
    end
  end
end
