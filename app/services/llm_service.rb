# frozen_string_literal: true

require 'net/http'
require 'json'

class LlmService
  def initialize openai_key, _opts = {}
    @openai_key = openai_key
  end

  def perform_judgement judgement
    user_prompt = make_user_prompt judgement.query_doc_pair
    results = get_llm_response user_prompt, judgement.user.system_prompt

    judgement.rating = results[:judgment]
    judgement.explanation = results[:explanation]

    judgement
  end

  def make_user_prompt query_doc_pair
    fields = JSON.parse(query_doc_pair.document_fields).to_yaml

    user_prompt = <<~TEXT
      Query: #{query_doc_pair.query_text}

      doc1:
        #{fields}
    TEXT

    user_prompt
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
      content = json_response['choices']&.first&.dig('message', 'content')
      parsed_content = begin
        JSON.parse(content)
      rescue StandardError
        {}
      end

      parsed_content = parsed_content['response'] if parsed_content['response']
      # puts "here is parsed"
      # puts parsed_content
      {
        explanation: parsed_content['explanation'],
        judgment:    parsed_content['judgment'],
      }
    else
      raise "Error: #{response.code} - #{response.message}"
    end
  end
  # rubocop:enable Metrics/MethodLength
end
