# frozen_string_literal: true

require 'test_helper'

class ApiKeysControllerTest < ActionDispatch::IntegrationTest
  let(:user)       { users(:doug) }
  let(:other_user) { users(:random) }

  before do
    login_user_for_integration_test user
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
