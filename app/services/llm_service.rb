# frozen_string_literal: true

require 'faraday'
require 'faraday/retry'
require 'json'

class LlmService
  def initialize llm_key, opts = {}
    default_options = {
      llm_service_url: 'https://api.openai.com',
      llm_model:       'gpt-4o',
      llm_timeout:     30,
    }

    @llm_key = llm_key
    @options = default_options.merge(opts.deep_symbolize_keys)
  end

  def perform_safe_judgement judgement
    perform_judgement(judgement)
  rescue RuntimeError => e
    judgement.explanation = "BOOM: Runtime Error: #{e.message}"
    judgement.unrateable = true
  rescue Faraday::Error => e
    # This will catch all Faraday errors including TimeoutError, ConnectionFailed, etc.
    judgement.explanation = "BOOM: API request failed: #{e.message}"
    judgement.unrateable = true
  end

  def perform_judgement judgement
    user_prompt = make_user_prompt judgement.query_doc_pair
    results = get_llm_response user_prompt, judgement.user.system_prompt

    judgement.rating = results[:judgment]
    judgement.explanation = results[:explanation]

    judgement
  end

  # rubocop:disable Metrics/MethodLength
  def make_user_prompt query_doc_pair
    document_fields = query_doc_pair.document_fields

    fields = if document_fields.blank?
               {}
             else
               JSON.parse(document_fields)
             end

    text_prompt = <<~TEXT
      Query: #{query_doc_pair.query_text}

      doc1:
        #{fields.to_yaml}
    TEXT

    prompt = [
      { type: 'text', text: text_prompt }
    ]

    if '' != fields['image'].to_s.strip
      image_url = fields['image']
      prompt << { type: 'image_url', image_url: { url: image_url } }
    end

    prompt
  end
  # rubocop:enable Metrics/MethodLength

  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/AbcSize
  def get_llm_response user_prompt, system_prompt
    conn = Faraday.new(url: @options[:llm_service_url]) do |f|
      f.request :json
      f.response :json
      f.adapter Faraday.default_adapter
      f.request :retry, {
        max:                 3,
        interval:            2,
        interval_randomness: 0.5,
        backoff_factor:      2,
        retry_statuses:      [ 429 ],
      }
    end

    body = {
      temperature:     0.7,
      model:           @options[:llm_model],
      response_format: { type: 'json_object' },
      messages:        [
        { role: 'system', content: system_prompt },
        { role: 'user', content: user_prompt }
      ],
    }

    response = conn.post('v1/chat/completions') do |req|
      req.headers['Authorization'] = "Bearer #{@llm_key}" if @llm_key.present?
      req.options.timeout = @options[:llm_timeout].to_i # Set request timeout
      req.body = body
    end

    if response.success?
      response_body = response.body
      if response_body.is_a?(String)
        # in our unit tests backed by webmock.rb the body is a String,
        # but in real use it's already formatted as JSON by Faraday
        response_body = JSON.parse(response_body)
      end
      content = response_body.dig('choices', 0, 'message', 'content')

      parsed_content = JSON.parse(content)
      {
        explanation: parsed_content['explanation'],
        judgment:    parsed_content['judgment'],
      }
    else
      raise "LLM API Error: #{response.status} - #{response.body}"
    end
  end
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Metrics/AbcSize
end
