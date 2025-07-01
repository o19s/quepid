# frozen_string_literal: true

class ChatChannel < ApplicationCable::Channel
  def subscribed
    stream_from 'chat_channel'
  end

  def unsubscribed
    # Any cleanup needed when channel is unsubscribed
  end

  def receive data
    # For now, just echo back a hardcoded response
    ActionCable.server.broadcast('chat_channel', {
      message:   data['message'],
      response:  'I am here',
      timestamp: Time.current.to_s,
    })
  end
end
