# frozen_string_literal: true

# == Schema Information
#
# Table name: api_keys
#
#  id           :bigint           not null, primary key
#  token_digest :string(255)      not null
#  created_at   :datetime         not null
#  updated_at   :datetime         not null
#  user_id      :integer
#
# Indexes
#
#  index_api_keys_on_token_digest  (token_digest)
#  index_api_keys_user_id          (user_id)
#

require 'test_helper'

class ApiKeyTest < ActiveSupport::TestCase
  let(:user) { users(:doug) }

  describe 'associations' do
    test 'belongs to a user' do
      api_key = ApiKey.new token: SecureRandom.hex

      assert_not api_key.valid?
      assert_includes api_key.errors[:user], 'must exist'
    end

    test 'is valid with a user and a token' do
      api_key = ApiKey.new user: user, token: SecureRandom.hex

      assert_predicate api_key, :valid?
    end
  end

  describe 'token digest generation' do
    test 'generates an HMAC digest of the raw token on create' do
      raw_token = SecureRandom.hex
      api_key = ApiKey.create! user: user, token: raw_token

      expected_digest = OpenSSL::HMAC.hexdigest('SHA256', ApiKey::HMAC_SECRET_KEY, raw_token)

      assert_equal expected_digest, api_key.token_digest
    end

    test 'raises a clean validation error when no token is given to hash' do
      api_key = ApiKey.new user: user

      assert_not api_key.valid?
      assert_includes api_key.errors[:token], "can't be blank"
      assert_raises(ActiveRecord::RecordInvalid) { api_key.save! }
    end
  end

  describe '.authenticate_by_token!' do
    test 'finds the api key matching the raw token' do
      raw_token = SecureRandom.hex
      api_key = ApiKey.create! user: user, token: raw_token

      found = ApiKey.authenticate_by_token!(raw_token)

      assert_equal api_key, found
    end

    test 'raises RecordNotFound when no api key matches the token' do
      assert_raises(ActiveRecord::RecordNotFound) do
        ApiKey.authenticate_by_token!('some-bogus-token')
      end
    end
  end

  describe '.authenticate_by_token' do
    test 'returns the api key matching the raw token' do
      raw_token = SecureRandom.hex
      api_key = ApiKey.create! user: user, token: raw_token

      found = ApiKey.authenticate_by_token(raw_token)

      assert_equal api_key, found
    end

    test 'returns nil instead of raising when no api key matches' do
      assert_nil ApiKey.authenticate_by_token('some-bogus-token')
    end
  end

  describe '#serializable_hash' do
    test 'includes the virtual token right after creation and excludes the digest' do
      raw_token = SecureRandom.hex
      api_key = ApiKey.create! user: user, token: raw_token

      hash = api_key.serializable_hash({})

      assert_equal raw_token, hash['token']
      assert_not hash.key?('token_digest')
    end

    test 'omits the token entirely once reloaded from the database' do
      raw_token = SecureRandom.hex
      api_key = ApiKey.create! user: user, token: raw_token

      reloaded = ApiKey.find(api_key.id)
      hash = reloaded.serializable_hash({})

      assert_not hash.key?('token')
      assert_not hash.key?('token_digest')
    end
  end
end
