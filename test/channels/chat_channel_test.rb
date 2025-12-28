# frozen_string_literal: true

require 'test_helper'

class ChatChannelTest < ActionCable::Channel::TestCase
  setup do
    @user = users(:doug)
  end

  test 'subscribes with authenticated user' do
    stub_connection current_user: @user
    subscribe
    assert subscription.confirmed?
    assert_has_stream "chat_channel_#{@user.id}"
  end

  test 'receives and processes messages' do
    stub_connection current_user: @user
    message = 'Hello, I need help'
    conversation_id = 'conv_123'

    subscribe

    assert_enqueued_with(job: ChatWithLlmJob) do
      perform :receive, {
        'message'         => message,
        'conversation_id' => conversation_id,
      }
    end
  end

  test 'generates conversation_id if not provided' do
    stub_connection current_user: @user
    message = 'Hello'

    subscribe

    assert_enqueued_jobs 1 do
      perform :receive, { 'message' => message }
    end

    # Verify the job was enqueued with a generated conversation_id
    job = ActiveJob::Base.queue_adapter.enqueued_jobs.last
    assert job[:args].first['conversation_id'].present?
  end

  test 'uses current_user id for channel name' do
    stub_connection current_user: @user
    message = 'Test message'

    subscribe

    assert_enqueued_with(job: ChatWithLlmJob) do
      perform :receive, { 'message' => message }
    end

    job = ActiveJob::Base.queue_adapter.enqueued_jobs.last
    assert_equal "chat_channel_#{@user.id}", job[:args].first['channel_name']
  end
end
