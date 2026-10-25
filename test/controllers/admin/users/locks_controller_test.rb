# frozen_string_literal: true

require 'test_helper'

module Admin
  module Users
    class LocksControllerTest < ActionDispatch::IntegrationTest
      let(:admin)  { users(:doug) }
      let(:target) { users(:random) }

      setup do
        login_user_for_integration_test admin
      end

      test 'locks an unlocked user and redirects to their admin page' do
        assert_not target.locked?

        patch admin_user_lock_url(user_id: target.id)

        assert_redirected_to admin_user_path(target)
        assert_response :see_other
        target.reload
        assert_predicate target, :locked?
        assert_not_nil target.locked_at
      end

      test 'unlocks a locked user and clears the lock time' do
        locked = users(:locked_user)
        assert_predicate locked, :locked?

        patch admin_user_lock_url(user_id: locked.id)

        assert_redirected_to admin_user_path(locked)
        locked.reload
        assert_not locked.locked?
        assert_nil locked.locked_at
      end

      test 'toggles back and forth on repeated requests' do
        patch admin_user_lock_url(user_id: target.id)
        assert_predicate target.reload, :locked?

        patch admin_user_lock_url(user_id: target.id)
        assert_not target.reload.locked?
      end

      test 'returns not found for a missing user' do
        patch admin_user_lock_url(user_id: 0)

        assert_response :not_found
      end

      test 'refuses a non-administrator and leaves the user unlocked' do
        login_user_for_integration_test users(:random_1)

        patch admin_user_lock_url(user_id: target.id)

        assert_redirected_to root_path
        assert_not target.reload.locked?
      end

      test 'sends an anonymous visitor to the login page and leaves the user unlocked' do
        reset!

        patch admin_user_lock_url(user_id: target.id)

        assert_redirected_to new_session_path
        assert_not target.reload.locked?
      end
    end
  end
end
