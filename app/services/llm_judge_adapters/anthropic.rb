# frozen_string_literal: true

module LlmJudgeAdapters
  # Anthropic's Messages API, direct or via Azure AI Foundry.
  class Anthropic < Base
    API_VERSION = '2023-06-01'
    MAX_TOKENS = 1048

    def path
      'v1/messages'
    end

    def body_for user_prompt, system_prompt
      # Anthropic Messages API format: system is a top-level param, not a message
      user_content = user_prompt.is_a?(Array) ? user_prompt.map { |part| content_block(part) } : user_prompt

      {
        model:      options[:llm_model],
        max_tokens: MAX_TOKENS,
        system:     system_prompt,
        messages:   [
          { role: 'user', content: user_content }
        ],
      }
    end

    # The answer is in the text blocks. Models that think by default (Claude Opus 5.5,
    # Sonnet 5.5) put a thinking block first, so the first block is not always text.
    def content_from response_body
      blocks = Array(response_body['content']).select { |block| 'text' == block['type'] }
      return nil if blocks.empty?

      # Anthropic doesn't support response_format, so the model may wrap JSON in markdown code blocks
      strip_markdown_code_block(blocks.pluck('text').join)
    end

    private

    def extra_headers
      { 'anthropic-version' => API_VERSION }
    end

    def content_block part
      case part[:type]
      when 'text'
        { type: 'text', text: part[:text] }
      when 'image_url'
        # Anthropic uses a different image format but supports URL sources
        { type: 'image', source: { type: 'url', url: part.dig(:image_url, :url) } }
      else
        part
      end
    end

    def strip_markdown_code_block text
      return text if text.nil?

      text = text.strip
      text = text.sub(/\A```\w*\n?/, '').sub(/\n?```\z/, '') if text.start_with?('```')
      text
    end
  end
end
