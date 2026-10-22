# frozen_string_literal: true

require 'test_helper'

class ApiKeysControllerTest < ActionDispatch::IntegrationTest
  let(:user)       { users(:doug) }
  let(:other_user) { users(:random) }

  before do
    login_user_for_integration_test user
  end

  describe 'create' do
    it 'issues the signed-in user a new random token and returns to the profile' do
      assert_difference 'user.api_keys.count', 1 do
        post api_keys_path
      end

      assert_redirected_to profile_path
      assert_response :see_other
      assert_match(/\A\h{64}\z/, user.api_keys.order(:id).last.token_digest) # HMAC-SHA256, never the raw token
    end

    it 'issues a different key each time and none to anyone else' do
      assert_no_difference 'other_user.api_keys.count' do
        post api_keys_path
        post api_keys_path
      end

      assert_equal 2, user.api_keys.pluck(:token_digest).uniq.size
    end

    it 'sends an anonymous visitor to the login page without issuing a key' do
      reset!

      assert_no_difference 'ApiKey.count' do
        post api_keys_path
      end

      assert_redirected_to new_session_path
    end
  end

  describe 'destroy' do
    it 'deletes a key the user owns' do
      api_key = user.api_keys.create! token: SecureRandom.hex

      assert_difference 'user.api_keys.count', -1 do
        delete api_key_path(api_key)
      end

      assert_redirected_to profile_path
    end

    it 'does not delete an api key belonging to another user' do
      foreign_key = other_user.api_keys.create! token: SecureRandom.hex

      assert_difference 'other_user.api_keys.count', 0 do
        delete api_key_path(foreign_key)
      end

      assert_response :not_found
    end
  end
end
