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
    conn = Faraday.new(url: 'https://api.openai.com') do |f|
      f.request :json # encode request bodies as JSON
      f.response :json # decode response bodies as JSON
      f.adapter Faraday.default_adapter
    end

    body = {
      model:    'gpt-4',
      messages: [
        { role: 'system', content: system_prompt },
        { role: 'user', content: user_prompt }
      ],
    }

    response = conn.post('/v1/chat/completions') do |req|
      req.headers['Authorization'] = "Bearer #{@openai_key}"
      req.headers['Content-Type'] = 'application/json'
      req.body = body
    end

    if response.success?
      json_response = JSON.parse(response.body)
      content = json_response['choices']&.first&.dig('message', 'content')
      # content = response.body.dig('choices', 0, 'message', 'content')
      parsed_content = begin
        JSON.parse(content)
      rescue StandardError
        {}
      end

      parsed_content = parsed_content['response'] if parsed_content['response']

      {
        explanation: parsed_content['explanation'],
        judgment:    parsed_content['judgment'],
      }
    else
      raise "Error: #{response.status} - #{response.body}"
    end
  end

  # rubocop:enable Metrics/MethodLength
end
