# frozen_string_literal: true

require 'net/http'
require 'json'

class LlmService
  def initialize openai_key, _opts = {}
    @openai_key = openai_key
  end

  def make_judgement _system_prompt, _user_prompt
    # scott write code.

    {
      explanation: 'Hi scott',
      rating:      rand(4),
    }
  end

  # rubocop:disable Metrics/MethodLength
  def get_llm_response user_prompt, system_prompt
    uri = URI('https://api.openai.com/v1/chat/completions')
    headers = {
      'Content-Type'  => 'application/json',
      'Authorization' => "Bearer #{@openai_key}",
    }
    body = {
      model:    'gpt-4',
      messages: [
        { role: 'system', content: system_prompt },
        { role: 'user', content: user_prompt }
      ],
    }
    response = Net::HTTP.start(uri.host, uri.port, use_ssl: true) do |http|
      request = Net::HTTP::Post.new(uri, headers)
      request.body = body.to_json
      http.request(request)
    end
    if response.is_a?(Net::HTTPSuccess)
      json_response = JSON.parse(response.body)
      # puts json_response
      content = json_response['choices']&.first&.dig('message', 'content')
      # puts content
      parsed_content = begin
        JSON.parse(content)
      rescue StandardError
        {}
      end

      # puts "here is parsed"
      # puts parsed_content
      {
        explanation: parsed_content['response']['explanation'],
        judgment:    parsed_content['response']['judgment_value'],
      }
    else
      raise "Error: #{response.code} - #{response.message}"
    end
  end
  # rubocop:enable Metrics/MethodLength
end
