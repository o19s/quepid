# frozen_string_literal: true

# Builds a RubyLLM::Context from the (llm_key, opts) shape used by
# AI Judges and other Quepid LLM features, mapping our provider names
# onto the right RubyLLM provider config keys.
#
# Recognized options keys (all optional except where noted):
#   llm_provider:    'openai' | 'anthropic' | 'ollama' |
#                    'azure_openai' | 'azure_ai_foundry' |
#                    'azure_ai_foundry_serverless' | 'azure_ai_foundry_anthropic'
#   llm_service_url: base URL for the provider (only forwarded when present)
#   llm_timeout:     request timeout in seconds (only forwarded when present)
class LlmContextBuilder
  ANTHROPIC_PROVIDERS = %w[anthropic azure_ai_foundry_anthropic].freeze
  AZURE_PROVIDERS = %w[azure_openai azure_ai_foundry azure_ai_foundry_serverless].freeze
  OLLAMA_PROVIDER = 'ollama'

  def self.build llm_key, opts = {}
    new(llm_key, opts).build
  end

  def self.provider_slug opts
    new(nil, opts).provider_slug
  end

  def initialize llm_key, opts = {}
    @llm_key = llm_key
    @options = opts.deep_symbolize_keys
  end

  def build
    provider = @options[:llm_provider].to_s
    base_url = @options[:llm_service_url]&.to_s&.chomp('/')
    timeout = @options[:llm_timeout]

    RubyLLM.context do |config|
      config.request_timeout = timeout.to_i if timeout.present?
      apply_provider_config(config, provider, base_url)
    end
  end

  def provider_slug
    provider = @options[:llm_provider].to_s
    return :anthropic if ANTHROPIC_PROVIDERS.include?(provider)
    return :azure     if AZURE_PROVIDERS.include?(provider)
    return :ollama    if OLLAMA_PROVIDER == provider

    :openai
  end

  private

  def apply_provider_config config, provider, base_url
    if ANTHROPIC_PROVIDERS.include?(provider)
      config.anthropic_api_key = @llm_key if @llm_key.present?
      config.anthropic_api_base = base_url if base_url.present?
    elsif AZURE_PROVIDERS.include?(provider)
      config.azure_api_key = @llm_key if @llm_key.present?
      config.azure_api_base = base_url if base_url.present?
    elsif OLLAMA_PROVIDER == provider
      config.ollama_api_base = "#{base_url}/v1" if base_url.present?
    else
      config.openai_api_key = @llm_key if @llm_key.present?
      config.openai_api_base = "#{base_url}/v1" if base_url.present?
    end
  end
end
