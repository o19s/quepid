# frozen_string_literal: true

require 'test_helper'

module Api
  class ApiControllerTest < ActionController::TestCase
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

    describe 'Quepid Qonfiguration' do
      test 'signup is enabled' do
        assert_predicate @controller, :signup_enabled?
      end
    end
  end
end
