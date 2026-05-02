# frozen_string_literal: true

module ActiveSupport
  class TestCase
    # Test API keys recognized by these stubs.
    OPENAI_VALID_KEY     = '1234asdf5678'
    OPENAI_BAD_KEY       = 'BAD_OPENAI_KEY'
    OPENAI_RATE_LIMIT_KEY = 'OPENAI_429_ERROR'

    # Registers the three default OpenAI chat-completion stubs:
    #   - Bearer 1234asdf5678   -> 200 with a canned judging response
    #   - Bearer BAD_OPENAI_KEY -> 401 Unauthorized
    #   - Bearer OPENAI_429_ERROR -> 429 Too Many Requests
    #
    # The 200 body has nested JSON inside the assistant's content; do not add
    # newlines to that string.
    def register_default_openai_stubs
      chat_completion_body = <<~TEXT
        {"id": "chatcmpl-Apgkot75TcZxjtOudaRkqzVmpCSBS",
          "object": "chat.completion",
          "created": 1736882438,
          "model": "gpt-4-0613",
          "choices": [
            {
              "index": 0,
              "message": {
                "role": "assistant",
                "content": "{\\"explanation\\": \\"This document explicitly states that it has nothing to do with farm animals and will not discuss them at all, making it irrelevant to the user's query concerning farm animals.\\",  \\"judgment\\": 0}",
                "refusal": null
              },
              "logprobs": null,
              "finish_reason": "stop"
            }
          ],
          "usage": {
            "prompt_tokens": 372,
            "completion_tokens": 50,
            "total_tokens": 422,
            "prompt_tokens_details": {
              "cached_tokens": 0,
              "audio_tokens": 0
            },
            "completion_tokens_details": {
              "reasoning_tokens": 0,
              "audio_tokens": 0,
              "accepted_prediction_tokens": 0,
              "rejected_prediction_tokens": 0
            }
          },
          "service_tier": "default",
          "system_fingerprint": null
        }
      TEXT

      stub_request(:post, 'https://api.openai.com/v1/chat/completions')
        .with(headers: { 'Authorization' => "Bearer #{OPENAI_VALID_KEY}" })
        .to_return(status: 200, body: chat_completion_body, headers: {})

      stub_request(:post, 'https://api.openai.com/v1/chat/completions')
        .with(headers: { 'Authorization' => "Bearer #{OPENAI_BAD_KEY}" })
        .to_return(status: 401, body: 'Unauthorized')

      stub_request(:post, 'https://api.openai.com/v1/chat/completions')
        .with(headers: { 'Authorization' => "Bearer #{OPENAI_RATE_LIMIT_KEY}" })
        .to_return(status: 429, body: 'Too Many Requests')
    end
  end
end
