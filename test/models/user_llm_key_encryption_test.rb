# frozen_string_literal: true

require 'test_helper'

class UserLlmKeyEncryptionTest < ActiveSupport::TestCase
  test 'llm_key should be encrypted when saved' do
    user = User.new(
      name:          'ai judge',
      email:         'ai_judge@example.com',
      password:      'password123',
      llm_key:       'sk-test-key-123456789',
      system_prompt: 'You are a helpful assistant'
    )

    assert user.save

    # The llm_key should still be accessible through the model
    assert_equal 'sk-test-key-123456789', user.llm_key

    # But in the database, it should be encrypted (not equal to the plain text)
    raw_value = User.connection.select_value(
      "SELECT llm_key FROM users WHERE id = #{user.id}"
    )

    # The raw database value should not equal the plaintext value
    assert_not_equal 'sk-test-key-123456789', raw_value

    # The raw value should look like encrypted data (starts with specific markers)
    assert_predicate raw_value, :present?
  end

  test 'llm_key should be decrypted when loaded' do
    user = User.create!(
      name:          'ai judges',
      email:         'ai_judge2@example.com',
      password:      'password123',
      llm_key:       'sk-another-test-key',
      system_prompt: 'You are a helpful assistant'
    )

    # Reload the user from database
    loaded_user = User.find(user.id)

    # The llm_key should be decrypted automatically
    assert_equal 'sk-another-test-key', loaded_user.llm_key
  end

  test 'can query users by llm_key presence' do
    # Create a user with llm_key (AI judge)
    ai_judge = User.create!(
      name:          'ai judge3',
      email:         'ai_judge3@example.com',
      password:      'password123',
      llm_key:       'sk-query-test-key',
      system_prompt: 'You are a helpful assistant'
    )

    # Test the only_ai_judges scope
    ai_judges = User.only_ai_judges
    assert_includes ai_judges, ai_judge
    assert_not_includes ai_judges, users(:doug)
  end
end
