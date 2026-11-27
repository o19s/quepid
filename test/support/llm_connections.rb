# frozen_string_literal: true

module ActiveSupport
  class TestCase
    # An unsaved Connection for an LLM provider, authenticating the way that provider's
    # connections do (ConnectionProvider::AUTH_FROM_STYLE): enough to build an LlmService
    # without fixtures. The default is OpenAI with the key the OpenAI stubs accept.
    def llm_connection(secret = OPENAI_VALID_KEY, provider: 'openai', base_url: 'https://api.openai.com',
                       api_version: nil, timeout: 30)
      auth = ConnectionProvider::AUTH_FROM_STYLE.fetch(LlmProvider.find(provider).auth_style.to_sym)
      Connection.new(name: "Test #{provider}", provider: provider, base_url: base_url, secret: secret,
                     timeout: timeout, api_version: api_version, **auth)
    end
  end
end
