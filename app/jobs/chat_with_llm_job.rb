# frozen_string_literal: true

class ChatWithLlmJob < ApplicationJob
  queue_as :default

  # rubocop:disable Metrics/AbcSize
  # rubocop:disable Metrics/MethodLength
  def perform message:, conversation_id:, channel_name:
    # Broadcast user message immediately
    ActionCable.server.broadcast(channel_name, {
      message:         message,
      sender:          'user',
      conversation_id: conversation_id,
      timestamp:       Time.current.to_s,
    })

    # Create LlmService instance
    api_key = Rails.application.config.quepid_openai_api_key
    llm_service = LlmService.new(api_key, {})

    # Start streaming response
    ActionCable.server.broadcast(channel_name, {
      sender:          'assistant',
      conversation_id: conversation_id,
      stream_start:    true,
      timestamp:       Time.current.to_s,
    })

    response_chunks = []
    chunk_sequence = 0

    llm_service.stream_chat_response(message) do |chunk|
      Rails.logger.info "Streaming chunk #{chunk_sequence}: #{chunk}"

      # Broadcast each chunk as it arrives with sequence number
      ActionCable.server.broadcast(channel_name, {
        sender:          'assistant',
        conversation_id: conversation_id,
        stream_chunk:    chunk,
        chunk_sequence:  chunk_sequence,
        timestamp:       Time.current.to_s,
      })

      response_chunks << chunk
      chunk_sequence += 1

      # Small delay to prevent overwhelming the websocket
      sleep(0.01) if (chunk_sequence % 5).zero?
    end

    # Send completion signal with total chunks count
    ActionCable.server.broadcast(channel_name, {
      sender:            'assistant',
      conversation_id:   conversation_id,
      stream_end:        true,
      complete_response: response_chunks.join,
      total_chunks:      chunk_sequence,
      timestamp:         Time.current.to_s,
    })
  rescue StandardError => e
    Rails.logger.error "Chat LLM Error: #{e.message}"

    ActionCable.server.broadcast(channel_name, {
      sender:          'assistant',
      conversation_id: conversation_id,
      error:           "Sorry, I encountered an error processing your message.Chat LLM Error: #{e.message}",
      timestamp:       Time.current.to_s,
    })
  end
  # rubocop:enable Metrics/AbcSize
  # rubocop:enable Metrics/MethodLength
end
