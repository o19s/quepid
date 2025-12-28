# frozen_string_literal: true

require 'test_helper'
require 'minitest/mock'

class ChatWithLlmJobTest < ActiveJob::TestCase
  setup do
    @user = users(:doug)
    @message = 'Hello, can you help me with search relevance?'
    @conversation_id = 'conv_123'
    @channel_name = "chat_channel_#{@user.id}"
  end

  test 'broadcasts user message immediately' do
    # Mock the streaming service
    mock_service = Minitest::Mock.new
    mock_service.expect(:stream_chat_response, nil) do |_message, &block|
      block.call('Hello! ')
    end

    LlmService.stub(:new, mock_service) do
      broadcasts = capture_broadcasts(@channel_name) do
        perform_enqueued_jobs do
          ChatWithLlmJob.perform_later(
            message:         @message,
            conversation_id: @conversation_id,
            channel_name:    @channel_name
          )
        end
      end

      # Find the user message broadcast
      user_broadcast = broadcasts.find { |b| 'user' == b[:sender] }
      assert user_broadcast, "No user broadcast found. Broadcasts: #{broadcasts.inspect}"
      assert_equal @message, user_broadcast[:message]
      assert_equal @conversation_id, user_broadcast[:conversation_id]
      assert user_broadcast[:timestamp].present?
    end

    mock_service.verify
  end

  test 'broadcasts stream start signal' do
    mock_service = Minitest::Mock.new
    mock_service.expect(:stream_chat_response, nil) do |message, &block|
      # No yielding in this test
    end

    LlmService.stub(:new, mock_service) do
      broadcasts = capture_broadcasts(@channel_name) do
        perform_enqueued_jobs do
          ChatWithLlmJob.perform_later(
            message:         @message,
            conversation_id: @conversation_id,
            channel_name:    @channel_name
          )
        end
      end

      stream_start_broadcast = broadcasts.find { |b| true == b[:stream_start] }
      assert stream_start_broadcast
      assert_equal 'assistant', stream_start_broadcast[:sender]
      assert_equal @conversation_id, stream_start_broadcast[:conversation_id]
    end

    mock_service.verify
  end

  test 'broadcasts stream chunks as they arrive' do
    chunks = [ 'Hello! ', 'I can help you ', 'with search relevance.' ]

    mock_service = Minitest::Mock.new
    mock_service.expect(:stream_chat_response, nil) do |_message, &block|
      chunks.each { |chunk| block.call(chunk) }
    end

    LlmService.stub(:new, mock_service) do
      broadcasts = capture_broadcasts(@channel_name) do
        perform_enqueued_jobs do
          ChatWithLlmJob.perform_later(
            message:         @message,
            conversation_id: @conversation_id,
            channel_name:    @channel_name
          )
        end
      end

      chunk_broadcasts = broadcasts.select { |b| b[:stream_chunk].present? }
      assert_equal chunks.size, chunk_broadcasts.size

      chunks.each_with_index do |chunk, index|
        assert_equal chunk, chunk_broadcasts[index][:stream_chunk]
        assert_equal 'assistant', chunk_broadcasts[index][:sender]
        assert_equal index, chunk_broadcasts[index][:chunk_sequence]
      end
    end

    mock_service.verify
  end

  test 'broadcasts stream end with complete response' do
    chunks = [ 'Hello! ', 'I can help.' ]

    mock_service = Minitest::Mock.new
    mock_service.expect(:stream_chat_response, nil) do |_message, &block|
      chunks.each { |chunk| block.call(chunk) }
    end

    LlmService.stub(:new, mock_service) do
      broadcasts = capture_broadcasts(@channel_name) do
        perform_enqueued_jobs do
          ChatWithLlmJob.perform_later(
            message:         @message,
            conversation_id: @conversation_id,
            channel_name:    @channel_name
          )
        end
      end

      end_broadcast = broadcasts.find { |b| true == b[:stream_end] }
      assert end_broadcast
      assert_equal 'assistant', end_broadcast[:sender]
      assert_equal chunks.join, end_broadcast[:complete_response]
      assert_equal chunks.size, end_broadcast[:total_chunks]
    end

    mock_service.verify
  end

  test 'handles errors gracefully' do
    mock_service = Minitest::Mock.new
    mock_service.expect(:stream_chat_response, nil) do |_message|
      raise StandardError, 'API Error'
    end

    LlmService.stub(:new, mock_service) do
      broadcasts = capture_broadcasts(@channel_name) do
        perform_enqueued_jobs do
          ChatWithLlmJob.perform_later(
            message:         @message,
            conversation_id: @conversation_id,
            channel_name:    @channel_name
          )
        end
      end

      error_broadcast = broadcasts.find { |b| b[:error].present? }
      assert error_broadcast
      assert_equal 'assistant', error_broadcast[:sender]
      assert_match(/Sorry, I encountered an error processing your message/, error_broadcast[:error])
    end

    mock_service.verify
  end

  test 'includes timestamp in all broadcasts' do
    mock_service = Minitest::Mock.new
    mock_service.expect(:stream_chat_response, nil) do |_message, &block|
      block.call('Test')
    end

    LlmService.stub(:new, mock_service) do
      broadcasts = capture_broadcasts(@channel_name) do
        perform_enqueued_jobs do
          ChatWithLlmJob.perform_later(
            message:         @message,
            conversation_id: @conversation_id,
            channel_name:    @channel_name
          )
        end
      end

      broadcasts.each do |broadcast|
        assert broadcast[:timestamp].present?
        assert_match(/\d{4}-\d{2}-\d{2}/, broadcast[:timestamp])
      end
    end

    mock_service.verify
  end

  private

  def capture_broadcasts channel, &block
    broadcasts = []

    ActionCable.server.stub(:broadcast, ->(channel_name, data) { broadcasts << data if channel_name == channel }) do
      block.call
    end

    broadcasts
  end
end
