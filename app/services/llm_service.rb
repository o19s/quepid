# frozen_string_literal: true

require 'faraday'
require 'json'

# Transport for a judging call: pick the adapter for this judge's provider, post
# the request it describes, hand the answer back to it. What the request looks
# like and what the answer means belong to the adapter (LlmJudgeAdapters).
class LlmService
  # The URL, timeout and API version come from the connection; only the model has a fallback.
  DEFAULT_OPTIONS = { llm_model: LlmProvider.find('openai').default_model }.freeze

  # @param connection [Connection] where to send the calls and how to authenticate (ADR 0005).
  def initialize connection, opts = {}
    raise ArgumentError, 'an AI judge needs a connection to call its provider' unless connection

    @connection = connection
    @options = DEFAULT_OPTIONS.merge(opts.deep_symbolize_keys, llm_service_url: connection.base_url, llm_timeout: connection.timeout)
    @options[:llm_api_version] = connection.api_version if @options[:llm_api_version].blank? && connection.api_version.present?
    @adapter = LlmJudgeAdapters.for(@options)
    @conn = LlmConnection.build(url: @options[:llm_service_url], retry_options: connection.retry_options)
  end

  def perform_safe_judgement judgement, scale: JudgeScale::NONE, book: nil
    perform_judgement(judgement, scale: book ? JudgeScale.for(book) : scale)
  rescue RuntimeError => e
    judgement.explanation = "#{Judgement::FAILED_CALL_PREFIX}: Runtime Error: #{e.message}"
    judgement.unrateable = true
    judgement.confidence = nil
  rescue Faraday::Error => e
    # This will catch all Faraday errors including TimeoutError, ConnectionFailed, etc.
    judgement.explanation = "#{Judgement::FAILED_CALL_PREFIX}: API request failed: #{e.message}"
    judgement.unrateable = true
    judgement.confidence = nil
  end

  # @param scale [JudgeScale] the rating scale the judge is held to. How it
  #   reaches the model -- described in the prompt, or sent as the question's
  #   criteria -- is the adapter's business.
  def perform_judgement judgement, scale: JudgeScale::NONE, book: nil
    scale = JudgeScale.for(book) if book
    envelope = @adapter.request_envelope(judgement.query_doc_pair,
                                         system_prompt: judgement.user.system_prompt,
                                         scale:         scale)

    @adapter.apply_response(judgement, post(envelope), scale: scale)
  end

  def make_user_prompt query_doc_pair
    @adapter.user_prompt(query_doc_pair)
  end

  def get_llm_response user_prompt, system_prompt
    @adapter.extract_judgement(post(@adapter.envelope(user_prompt, system_prompt)))
  end

  private

  # @return [Hash] the parsed response body
  def post envelope
    response = @conn.post(envelope[:path]) do |req|
      req.headers.merge!(envelope[:headers])
      req.headers.merge!(@connection.request_headers)
      req.options.timeout = @options[:llm_timeout].to_i
      req.body = envelope[:body]
    end

    raise "LLM API Error: #{response.status} - #{response.body}" unless response.success?

    body = response.body
    body.is_a?(String) ? JSON.parse(body) : body
  rescue JSON::ParserError => e
    # A 200 that is not JSON (an HTML error page from a proxy, a truncated body)
    # is an API failure like any other, so callers' RuntimeError handling applies.
    raise "LLM API Error: response was not valid JSON (#{e.message})"
  end
end
