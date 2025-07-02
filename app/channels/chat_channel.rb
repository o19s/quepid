# frozen_string_literal: true

class ChatChannel < ApplicationCable::Channel
  def subscribed
    # Connection already authenticated, use current_user from connection
    stream_from "chat_channel_#{current_user.id}"
  end

  def unsubscribed
    # Any cleanup needed when channel is unsubscribed
  end

  def receive data
    # current_user is guaranteed to exist from connection authentication
    ChatWithLlmJob.perform_later(
      message:         data['message'],
      conversation_id: data['conversation_id'] || SecureRandom.uuid,
      channel_name:    "chat_channel_#{current_user.id}"
    )
  end
end
