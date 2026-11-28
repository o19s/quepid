# frozen_string_literal: true

module ActiveSupport
  class TestCase
    # A Connection for an LLM provider, set up the way the connection form sets one up for that
    # provider (ConnectionProvider): enough to build an LlmService without fixtures. The default
    # is OpenAI with the key the OpenAI stubs accept. Saved when given an owner, unsaved otherwise;
    # other attributes (base_url, timeout, api_version) override the provider's defaults.
    def llm_connection secret = OPENAI_VALID_KEY, provider: 'openai', owner: nil, **attributes
      definition = ConnectionProvider.find(provider)
      connection = Connection.new(name: "Test #{definition.label}", provider: provider, secret: secret, owner: owner,
                                  base_url: definition.default_base_url, timeout: 30,
                                  auth_scheme: definition.auth_scheme, auth_header: definition.auth_header,
                                  **attributes)
      connection.save! if owner
      connection
    end
  end
end
