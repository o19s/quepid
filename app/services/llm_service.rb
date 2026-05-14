# frozen_string_literal: true

require 'json'

class LlmService
  JUDGMENT_SCHEMA = {
    type:                 'object',
    properties:           {
      explanation: { type: 'string' },
      judgment:    { type: 'number' },
    },
    required:             %w[explanation judgment],
    additionalProperties: false,
  }.freeze

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
  rescue RubyLLM::Error => e
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

    image_url = detect_image_url(document_fields)
    prompt << { type: 'image_url', image_url: { url: image_url } } if image_url

    prompt
  end

  IMAGE_URL_REGEX = %r{\Ahttps?://\S+\.(?:png|jpe?g|gif|webp|bmp|svg|tiff?)(?:\?\S*)?\z}i

  def detect_image_url document_fields
    document_fields.each_value do |value|
      str = value.to_s.strip
      return str if str.match?(IMAGE_URL_REGEX)
    end
    nil
  end

  def get_llm_response user_prompt, system_prompt
    context = build_ruby_llm_context
    chat = context.chat(
      model:               @options[:llm_model],
      provider:            provider_slug,
      assume_model_exists: true
    )
    chat.with_instructions(system_prompt, replace: true)
    chat.with_schema(JUDGMENT_SCHEMA)

    text, image_url = extract_text_and_image(user_prompt)

    response = if image_url.present?
                 chat.ask(text, with: image_url)
               else
                 chat.ask(text)
               end

    parse_content(response)
  end

  private

  def build_ruby_llm_context
    provider = @options[:llm_provider].to_s
    base_url = @options[:llm_service_url].to_s.chomp('/')

    RubyLLM.context do |config|
      config.request_timeout = @options[:llm_timeout].to_i
      case provider
      when 'anthropic', 'azure_ai_foundry_anthropic'
        config.anthropic_api_key = @llm_key
        config.anthropic_api_base = base_url
      when 'azure_openai', 'azure_ai_foundry', 'azure_ai_foundry_serverless'
        config.azure_api_key = @llm_key
        config.azure_api_base = base_url
      when 'ollama'
        config.ollama_api_base = "#{base_url}/v1"
      else
        # 'openai', 'google_gemini' (OpenAI-compatible endpoint), or nil/empty
        config.openai_api_key = @llm_key
        config.openai_api_base = "#{base_url}/v1"
      end
    end
  end

  def provider_slug
    case @options[:llm_provider].to_s
    when 'anthropic', 'azure_ai_foundry_anthropic'                          then :anthropic
    when 'ollama'                                                           then :ollama
    when 'azure_openai', 'azure_ai_foundry', 'azure_ai_foundry_serverless'  then :azure
    else                                                                         :openai
    end
  end

  def extract_text_and_image user_prompt
    if user_prompt.is_a?(Array)
      text = user_prompt.find { |p| 'text' == p[:type] }&.dig(:text)
      image_url = user_prompt.find { |p| 'image_url' == p[:type] }&.dig(:image_url, :url)
      [ text, image_url ]
    else
      [ user_prompt, nil ]
    end
  end

  def parse_content response
    content = response.content
    content = JSON.parse(strip_markdown_code_block(content.to_s)) unless content.is_a?(Hash)
    {
      explanation: content['explanation'],
      judgment:    content['judgment'],
    }
  end

  def strip_markdown_code_block text
    return text if text.nil?

    text = text.strip
    text = text.sub(/\A```\w*\n?/, '').sub(/\n?```\z/, '') if text.start_with?('```')
    text
  end
end
