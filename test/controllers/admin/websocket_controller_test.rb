# frozen_string_literal: true

require 'test_helper'


module Admin
  class WebsocketTesterControllerTest < ActionDispatch::IntegrationTest
    test 'should get index' do
      get admin_websocket_tester_index_url
      assert_response :success
    end
  end
end
