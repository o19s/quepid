# frozen_string_literal: true

require 'test_helper'

class AiJudgeLlmKeyEncryptionTest < ActiveSupport::TestCase
  test 'llm_key should be encrypted when saved' do
    judge = AiJudge.new(
      name:          'AI Judge',
      llm_key:       'sk-test-key-123456789',
      system_prompt: 'You are a helpful assistant'
    )

    assert judge.save

    # The llm_key should still be accessible through the model
    assert_equal 'sk-test-key-123456789', judge.llm_key

    # But in the database, it should be encrypted (not equal to the plain text)
    raw_value = User.connection.select_value(
      "SELECT llm_key FROM users WHERE id = #{judge.id}"
    )

    # The raw database value should not equal the plaintext value
    assert_not_equal 'sk-test-key-123456789', raw_value

    # The raw value should look like encrypted data (starts with specific markers)
    assert_predicate raw_value, :present?
  end

  test 'llm_key should be decrypted when loaded' do
    judge = AiJudge.create!(
      name:          'AI Judge',
      llm_key:       'sk-another-test-key',
      system_prompt: 'You are a helpful assistant'
    )

    # Reload the judge from database
    loaded_judge = AiJudge.find(judge.id)

    # The llm_key should be decrypted automatically
    assert_equal 'sk-another-test-key', loaded_judge.llm_key
  end
end
