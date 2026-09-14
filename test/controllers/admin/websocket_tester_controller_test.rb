# frozen_string_literal: true

require 'test_helper'

module Admin
  class WebsocketTesterControllerTest < ActionDispatch::IntegrationTest
    let(:user) { users(:doug) }
    let(:non_admin_user) { users(:random) }

    test 'should get index' do
      get root_url
      assert_response :redirect
      follow_redirect!

      login_user_for_integration_test user

      get admin_websocket_tester_index_url
      assert_response :success
    end

    test 'blocks a non-admin user' do
      login_user_for_integration_test non_admin_user

      get admin_websocket_tester_index_url
      assert_redirected_to root_url
      assert_equal 'You must be a Quepid Administrator.', flash[:notice]
    end
  end
end
