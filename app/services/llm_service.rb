# frozen_string_literal: true

require 'faraday'
require 'json'

# Transport for a judging call: pick the adapter for this judge's provider, post
# the request it describes, hand the answer back to it. What the request looks
# like and what the answer means belong to the adapter (LlmJudgeAdapters).
class LlmService
  DEFAULT_OPTIONS = begin
    openai = LlmProvider.find('openai')
    {
      llm_service_url: openai.default_service_url,
      llm_model:       openai.default_model,
      llm_timeout:     30,
    }
  end.freeze

  def initialize llm_key, opts = {}
    @llm_key = llm_key
    @options = DEFAULT_OPTIONS.merge(opts.deep_symbolize_keys)
    @adapter = LlmJudgeAdapters.for(@llm_key, @options)
    @conn = LlmConnection.build(url: @options[:llm_service_url])
  end

  def perform_safe_judgement judgement, scale: JudgeScale::NONE
    perform_judgement(judgement, scale: scale)
  rescue RuntimeError => e
    judgement.explanation = "BOOM: Runtime Error: #{e.message}"
    judgement.unrateable = true
  rescue Faraday::Error => e
    # This will catch all Faraday errors including TimeoutError, ConnectionFailed, etc.
    judgement.explanation = "BOOM: API request failed: #{e.message}"
    judgement.unrateable = true
  end

  # @param scale [JudgeScale] the rating scale the judge is held to. How it
  #   reaches the model -- described in the prompt, or sent as the question's
  #   criteria -- is the adapter's business.
  def perform_judgement judgement, scale: JudgeScale::NONE
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
      req.options.timeout = @options[:llm_timeout].to_i
      req.body = envelope[:body]
    end

    raise "LLM API Error: #{response.status} - #{response.body}" unless response.success?

    body = response.body
    body.is_a?(String) ? JSON.parse(body) : body
  end
end
