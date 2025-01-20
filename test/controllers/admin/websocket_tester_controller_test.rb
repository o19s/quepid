# frozen_string_literal: true

require 'test_helper'

module Admin
  class WebsocketTesterControllerTest < ActionDispatch::IntegrationTest
    let(:user) { users(:doug) }

    test 'should get index' do
      get root_url
      assert_response :redirect
      follow_redirect!

      login_user_for_integration_test user

      get admin_websocket_tester_index_url
      assert_response :success
    end
  end
end
