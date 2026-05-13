# frozen_string_literal: true

require 'faraday'
require 'faraday/retry'
require 'json'

class LlmService
  AZURE_PROVIDERS = %w[azure_openai azure_ai_foundry azure_ai_foundry_serverless azure_ai_foundry_anthropic].freeze
  ANTHROPIC_PROVIDERS = %w[anthropic azure_ai_foundry_anthropic].freeze

  def initialize llm_key, opts = {}
    default_options = {
      llm_service_url: 'https://api.openai.com',
      llm_model:       'gpt-4o',
      llm_timeout:     30,
    }

    @llm_key = llm_key
    @options = default_options.merge(opts.deep_symbolize_keys)
    @conn = build_connection
    @completions_path = compute_completions_path
    @auth_headers = compute_auth_headers
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

  def make_user_prompt query_doc_pair
    document_fields = query_doc_pair.document_fields

    text_prompt = <<~TEXT
      Query: #{query_doc_pair.query_text}

      doc1:
        #{document_fields.to_yaml}
    TEXT

    prompt = [
      { type: 'text', text: text_prompt }
    ]

    # This is hard coded to `image` and should be any image.
    # image or thumb ;-(
    if '' != document_fields['image'].to_s.strip
      image_url = document_fields['image']
      prompt << { type: 'image_url', image_url: { url: image_url } }
    end

    prompt
  end

  def get_llm_response user_prompt, system_prompt
    if anthropic_provider?
      get_anthropic_response(user_prompt, system_prompt)
    else
      get_openai_response(user_prompt, system_prompt)
    end
  end

  private

  def build_connection
    Faraday.new(url: @options[:llm_service_url]) do |f|
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
  end

  def get_openai_response user_prompt, system_prompt
    body = {
      temperature:     0.7,
      model:           @options[:llm_model],
      response_format: { type: 'json_object' },
      messages:        [
        { role: 'system', content: system_prompt },
        { role: 'user', content: user_prompt }
      ],
    }

    response = post_request(body)
    parse_response(response) { |body| body.dig('choices', 0, 'message', 'content') }
  end

  def get_anthropic_response user_prompt, system_prompt
    # Anthropic Messages API format: system is a top-level param, not a message
    user_content = user_prompt.is_a?(Array) ? user_prompt.map { |p| anthropic_content_block(p) } : user_prompt

    body = {
      model:       @options[:llm_model],
      max_tokens:  1048,
      temperature: 0.7,
      system:      system_prompt,
      messages:    [
        { role: 'user', content: user_content }
      ],
    }

    response = post_request(body) do |req|
      req.headers['anthropic-version'] = '2023-06-01'
    end

    parse_response(response) do |body|
      # Anthropic doesn't support response_format, so the model may wrap JSON in markdown code blocks
      strip_markdown_code_block(body.dig('content', 0, 'text'))
    end
  end

  def post_request body
    @conn.post(@completions_path) do |req|
      req.headers.merge!(@auth_headers) if @llm_key.present?
      req.options.timeout = @options[:llm_timeout].to_i
      req.body = body
      yield req if block_given?
    end
  end

  def parse_response response
    raise "LLM API Error: #{response.status} - #{response.body}" unless response.success?

    response_body = response.body
    response_body = JSON.parse(response_body) if response_body.is_a?(String)

    content = yield response_body
    parsed_content = JSON.parse(content)
    {
      explanation: parsed_content['explanation'],
      judgment:    parsed_content['judgment'],
    }
  end

  def anthropic_content_block part
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

  def anthropic_provider?
    ANTHROPIC_PROVIDERS.include?(@options[:llm_provider].to_s)
  end

  def azure_provider?
    AZURE_PROVIDERS.include?(@options[:llm_provider].to_s)
  end

  def compute_completions_path
    api_version = @options[:llm_api_version].presence
    case @options[:llm_provider].to_s
    when 'azure_openai'
      if api_version
        "openai/deployments/#{@options[:llm_model]}/chat/completions?api-version=#{api_version}"
      else
        'openai/v1/chat/completions'
      end
    when 'azure_ai_foundry'
      api_version ||= '2025-01-01-preview'
      "models/chat/completions?api-version=#{api_version}"
    when 'azure_ai_foundry_anthropic', 'anthropic'
      'v1/messages'
    else
      'v1/chat/completions'
    end
  end

  def compute_auth_headers
    if anthropic_provider?
      { 'x-api-key' => @llm_key }
    elsif azure_provider?
      { 'api-key' => @llm_key }
    else
      { 'Authorization' => "Bearer #{@llm_key}" }
    end
  end
end
