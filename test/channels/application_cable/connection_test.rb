# frozen_string_literal: true

require 'test_helper'
module ApplicationCable
  class ConnectionTest < ActionCable::Connection::TestCase
    tests ApplicationCable::Connection
    test 'connects with params' do
      # Simulate a connection opening by calling the `connect` method
      connect params: { user_id: 42 }

      # You can access the Connection object via `connection` in tests
      #
      pp connection
      assert_equal connection.user_id, '42'
    end

    # test "connects with cookies" do
    #   cookies.signed[:user_id] = 42
    #
    #   connect
    #
    #   assert_equal connection.user_id, "42"
    # end
    #
    # test 'connects without authentication' do
    #     # Simulate a WebSocket connection
    #     connect

    #     # Assert that the connection was established successfully
    #     assert_connection_established
    #   end
  end
end
