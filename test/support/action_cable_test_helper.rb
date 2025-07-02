# frozen_string_literal: true

module ActionCableTestHelper
  # Helper to assert broadcasts on a specific channel
  # rubocop:disable Metrics/MethodLength
  def assert_broadcast_on channel, expected_data = nil, &block
    broadcasts = []

    # Capture broadcasts during block execution
    ActionCable.server.stubs(:broadcast).with do |channel_name, data|
      broadcasts << { channel: channel_name, data: data }
      true
    end

    block.call

    # Find broadcasts for the specific channel
    channel_broadcasts = broadcasts.select { |b| b[:channel] == channel }.map { |b| b[:data] }

    if expected_data
      matching_broadcast = channel_broadcasts.find do |broadcast|
        matches_expected_data?(broadcast, expected_data)
      end

      assert matching_broadcast,
             "Expected broadcast with #{expected_data.inspect} on #{channel}, but got: #{channel_broadcasts.inspect}"
    else
      assert channel_broadcasts.any?,
             "Expected at least one broadcast on #{channel}, but got none"
    end
  end
  # rubocop:enable Metrics/MethodLength

  private

  def matches_expected_data? actual, expected
    expected.all? do |key, value|
      if :anything == value || value == anything
        actual.key?(key.to_s)
      else
        actual[key.to_s] == value
      end
    end
  end

  # Helper to match any value in assertions
  def anything
    :anything
  end
end

# Include in ActiveSupport::TestCase
ActiveSupport.on_load(:active_support_test_case) { include ActionCableTestHelper }
