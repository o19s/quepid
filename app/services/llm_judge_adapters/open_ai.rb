# frozen_string_literal: true

module LlmJudgeAdapters
  # The chat-completions dialect: OpenAI itself, its Azure deployments, and the
  # OpenAI-compatible endpoints (Gemini, Ollama).
  class OpenAi < Base
    FOUNDRY_DEFAULT_API_VERSION = '2025-01-01-preview'

    def path
      api_version = options[:llm_api_version].presence

      case options[:llm_provider].to_s
      when 'azure_openai'
        if api_version
          "openai/deployments/#{options[:llm_model]}/chat/completions?api-version=#{api_version}"
        else
          'openai/v1/chat/completions'
        end
      when 'azure_ai_foundry'
        "models/chat/completions?api-version=#{api_version || FOUNDRY_DEFAULT_API_VERSION}"
      else
        'v1/chat/completions'
      end
    end

    def body_for user_prompt, system_prompt
      {
        temperature:     0.7,
        model:           options[:llm_model],
        response_format: { type: 'json_object' },
        messages:        [
          { role: 'system', content: system_prompt },
          { role: 'user', content: user_prompt }
        ],
      }
    end

    def content_from response_body
      response_body.dig('choices', 0, 'message', 'content')
    end
  end
end
