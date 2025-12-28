# frozen_string_literal: true

require 'net/http'
require 'json'
require 'uri'

# rubocop:disable Metrics/ClassLength
class LlmService
  class RateLimitError < StandardError; end

  def initialize llm_key, opts = {}
    default_options = {
      llm_service_url: 'https://api.openai.com',
      llm_model:       'gpt-4o',
      llm_timeout:     30,
    }

    @llm_key = llm_key
    @options = default_options.merge(opts.deep_symbolize_keys)
  end

  # Judgement-specific methods
  def perform_safe_judgement judgement
    perform_judgement(judgement)
  rescue RuntimeError => e
    judgement.explanation = "BOOM: Runtime Error: #{e.message}"
    judgement.unrateable = true
  rescue StandardError => e
    # This will catch all errors including timeout, connection failed, etc.
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

  # Chat methods with streaming support
  def stream_chat_response(message, &)
    # For non-OpenAI services or if streaming fails, fall back to regular response
    unless supports_streaming?
      response = get_chat_response(message)
      yield response if block_given?
      return
    end

    stream_response(message, &)
  end

  def get_chat_response message
    # Non-streaming chat response
    messages = build_chat_messages(message)

    body = {
      messages:    messages,
      temperature: 0.7,
      model:       @options[:llm_model],
    }

    response_body = make_api_request(body)

    response_body.dig('choices', 0, 'message', 'content') || 'I apologize, but I could not generate a response.'
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
  def get_llm_response user_prompt, system_prompt
    body = {
      temperature:     0.7,
      model:           @options[:llm_model],
      response_format: { type: 'json_object' },
      messages:        [
        { role: 'system', content: system_prompt },
        { role: 'user', content: user_prompt }
      ],
    }

    response_body = make_api_request(body)

    content = response_body.dig('choices', 0, 'message', 'content')

    parsed_content = JSON.parse(content)
    {
      explanation: parsed_content['explanation'],
      judgment:    parsed_content['judgment'],
    }
  end
  # rubocop:enable Metrics/MethodLength

  private

  def supports_streaming?
    # Only OpenAI API reliably supports streaming
    @options[:llm_service_url] =~ /openai\.com/
  end

  def build_chat_messages message
    [
      {
        role:    'system',
        content: 'You are a helpful assistant for Quepid, a search relevance tuning application. Help users with their questions about search quality, relevance tuning, and using Quepid effectively.',
      },
      {
        role:    'user',
        content: message,
      }
    ]
  end

  # rubocop:disable Metrics/MethodLength
  def make_api_request body, max_retries = 3
    uri = URI.parse("#{@options[:llm_service_url]}/v1/chat/completions")

    headers = {
      'Content-Type'  => 'application/json',
      'Authorization' => "Bearer #{@llm_key}",
    }

    # Add default model if not specified
    body[:model] ||= @options[:llm_model]

    retries = 0
    begin
      http = create_http_client(uri)

      request = Net::HTTP::Post.new(uri.path, headers)
      request.body = body.to_json

      response = http.request(request)

      case response.code
      when '200'
        JSON.parse(response.body)
      when '429'
        # Rate limit - retry with exponential backoff
        raise RateLimitError, 'Rate limited'
      else
        raise "LLM API Error: #{response.code} - #{response.body}"
      end
    rescue RateLimitError => e
      raise "Rate limit exceeded after #{max_retries} retries" if retries >= max_retries

      retries += 1
      sleep_time = (2**(retries - 1)) + rand(0.5)
      sleep(sleep_time)
      retry
    rescue Net::OpenTimeout, Net::ReadTimeout => e
      raise "Request timeout: #{e.message}"
    end
  end
  # rubocop:enable Metrics/MethodLength

  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/AbcSize
  # rubocop:disable Metrics/CyclomaticComplexity
  # rubocop:disable Metrics/PerceivedComplexity
  def stream_response message
    uri = URI.parse("#{@options[:llm_service_url]}/v1/chat/completions")

    headers = {
      'Content-Type'  => 'application/json',
      'Authorization' => "Bearer #{@llm_key}",
    }

    request_body = {
      model:       @options[:llm_model],
      messages:    build_chat_messages(message),
      stream:      true,
      temperature: 0.7,
      max_tokens:  1000,
    }

    http = create_http_client(uri)

    request = Net::HTTP::Post.new(uri.path, headers)
    request.body = request_body.to_json

    http.request(request) do |response|
      raise "HTTP Error: #{response.code}" unless '200' == response.code

      response.read_body do |chunk|
        # Process server-sent events
        chunk.split("\n").each do |line|
          next if line.strip.empty?
          next unless line.start_with?('data: ')

          data = line[6..].strip
          next if '[DONE]' == data

          begin
            parsed = JSON.parse(data)
            content = parsed.dig('choices', 0, 'delta', 'content')
            yield content if content && block_given?
          rescue JSON::ParserError => e
            Rails.logger.warn "Failed to parse SSE chunk: #{e.message}"
          end
        end
      end
    end
  rescue Net::ReadTimeout => e
    Rails.logger.error "Streaming timeout: #{e.message}"
    yield "I apologize, but I'm having trouble connecting to the service. Please try again later."
  rescue StandardError => e
    Rails.logger.error "Streaming error: #{e.message}"
    yield 'I encountered an error while processing your request. Please try again.'
  end
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Metrics/AbcSize
  # rubocop:enable Metrics/CyclomaticComplexity
  # rubocop:enable Metrics/PerceivedComplexity

  def create_http_client uri
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = 'https' == uri.scheme
    http.open_timeout = 5 # Connection timeout
    http.read_timeout = @options[:llm_timeout]
    http
  end
end
# rubocop:enable Metrics/ClassLength
