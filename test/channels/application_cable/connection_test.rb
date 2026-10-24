# frozen_string_literal: true

require 'test_helper'

module ApplicationCable
  class ConnectionTest < ActionCable::Connection::TestCase
    test 'authenticates the Rails session' do
      connect session: { current_user_id: users(:doug).id }
      assert_equal users(:doug), connection.current_user
    end

    test 'rejects anonymous and deleted users' do
      assert_reject_connection { connect }
      assert_reject_connection { connect session: { current_user_id: -1 } }
    end

    test 'rejects locked users' do
      user = users(:doug)
      user.update!(locked: true)
      assert_reject_connection { connect session: { current_user_id: user.id } }
    end

    test 'does not authenticate a user id in query parameters' do
      assert_reject_connection { connect params: { current_user_id: users(:doug).id } }
    end
  end
end
