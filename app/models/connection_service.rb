# frozen_string_literal: true

# One service a Connection can be pointed at (OpenAI, Voyage, Ollama, Elasticsearch, ...), and the
# registry of all of them (ADR 0005).
#
# Like LlmProvider and EmbedderProvider, not an ActiveRecord model: the set of services is code.
# A connection stores only the service `key`. What the service is for lives in `capabilities`, so
# the pickers that will use a connection (embedders, AI judges) can offer only the ones that fit.
#
# The label, URL, help text and how the key is sent are read from LlmProvider and EmbedderProvider
# for the services they already describe, so there is one place to change them; only the services
# they know nothing about (the search engines) are spelled out here.
class ConnectionService
  include ActiveModel::Model
  include ActiveModel::Attributes

  CAPABILITIES = %w[chat typed_judge embeddings search].freeze

  # How LlmProvider/EmbedderProvider say the key is sent, in ConnectionService terms.
  AUTH_FROM_STYLE = {
    bearer:    { auth_scheme: 'bearer' },
    none:      { auth_scheme: 'none' },
    api_key:   { auth_scheme: 'header', auth_header: 'api-key' },
    x_api_key: { auth_scheme: 'header', auth_header: 'x-api-key' },
  }.freeze

  # Services the two provider registries don't describe.
  SEARCH_DEFINITIONS = [
    {
      key:              'elasticsearch',
      label:            'Elasticsearch',
      default_base_url: 'http://localhost:9200',
      auth_scheme:      'basic',
      capabilities:     %w[search],
      help_html:        <<~HTML.squish,
        <strong>Elasticsearch</strong> &mdash; a search cluster.<br>
        <b>Key:</b> <code>user:password</code> for basic auth, or switch the scheme to
        <code>ApiKey</code> and paste an API key (the base64 <code>encoded</code> value).
      HTML
    },
    {
      key:              'opensearch',
      label:            'OpenSearch',
      default_base_url: 'http://localhost:9200',
      auth_scheme:      'basic',
      capabilities:     %w[search],
      help_html:        '<strong>OpenSearch</strong> &mdash; a search cluster. <b>Key:</b> <code>user:password</code> for basic auth.',
    },
    {
      key:              'solr',
      label:            'Solr',
      default_base_url: 'http://localhost:8983',
      auth_scheme:      'basic',
      capabilities:     %w[search],
      help_html:        '<strong>Solr</strong> &mdash; <b>Key:</b> <code>user:password</code> if the instance uses basic auth, blank if not.',
    }
  ].freeze

  # Endpoints that answer a GET with 2xx only when the credentials work, so a check can say more
  # than "something is listening". Services not listed are only checked for being reachable.
  CHECK_PATHS = {
    'openai'            => 'v1/models',
    'openai_compatible' => 'v1/models',
    'anthropic'         => 'v1/models',
    'cohere'            => 'v1/models',
    'google_gemini'     => 'models',
    'ollama'            => 'api/tags',
    'elasticsearch'     => '',
    'opensearch'        => '',
  }.freeze

  # The services whose calls carry an api-version (Azure's OpenAI-style endpoints).
  API_VERSION_SERVICES = %w[azure_openai azure_ai_foundry azure_ai_foundry_serverless].freeze

  # Headers a service insists on even for the check.
  CHECK_HEADERS = {
    'anthropic' => { 'anthropic-version' => '2023-06-01' },
  }.freeze

  attribute :key,              :string
  attribute :label,            :string
  attribute :default_base_url, :string
  attribute :auth_scheme,      :string, default: 'bearer'
  # Only for auth_scheme "header": the name of the header carrying the key.
  attribute :auth_header,      :string
  # Whether the service rejects every request without a key.
  attribute :requires_secret,  :boolean, default: false
  attribute :capabilities,     default: -> { [] }
  attribute :help_html,        :string
  # The API version a service starts with (blank is a valid choice for some Azure services).
  attribute :default_api_version, :string, default: ''

  class << self
    def all
      @all ||= (llm_and_embedder_definitions + SEARCH_DEFINITIONS.map { |definition| new(definition) })
    end

    # Not just indirection: RuboCop's Rails/FindEach cop mistakes `ConnectionService.all.each`
    # for an ActiveRecord relation and flags it, so callers use this instead.
    def each(&)
      all.each(&)
    end

    def find key
      all.find { |service| service.key == key.to_s }
    end

    def keys
      all.map(&:key)
    end

    # [[label, key], ...] for options_for_select
    def select_options
      all.map { |service| [ service.label, service.key ] }
    end

    # The settings the connection form fills in when a service is picked, keyed by service.
    def presets
      all.index_by(&:key).transform_values(&:to_preset)
    end

    # The services whose connections can serve this capability, for a picker.
    def with_capability capability
      all.select { |service| service.capabilities.include?(capability.to_s) }
    end

    private

    # The providers are rebuilt on every call (Ollama's URL is deployment config), so this is
    # built once per process, like any other registry.
    def llm_and_embedder_definitions
      keys = (LlmProvider.all.map(&:key) + EmbedderProvider.all.map(&:key)).uniq
      keys.map { |key| from_providers(key) }
    end

    def from_providers key
      llm = LlmProvider.find(key)
      embedder = EmbedderProvider.find(key)
      primary = llm || embedder
      auth = AUTH_FROM_STYLE.fetch(auth_style_of(llm, embedder, primary))

      new(
        {
          key:                 key,
          label:               primary.label,
          default_base_url:    primary.default_service_url,
          requires_secret:     'none' != auth[:auth_scheme] && (embedder.nil? || embedder.requires_key?),
          capabilities:        capabilities_of(llm, embedder),
          help_html:           primary.help_html,
          default_api_version: llm&.default_api_version.to_s,
        }.merge(auth)
      )
    end

    # A service that either registry says takes no key takes none.
    def auth_style_of llm, embedder, primary
      return :none if [ llm, embedder ].compact.any? { |provider| :none == provider.auth_style.to_sym }

      primary.auth_style.to_sym
    end

    def capabilities_of llm, embedder
      capabilities = []
      capabilities << (llm.needs_scale? ? 'typed_judge' : 'chat') if llm
      capabilities << 'embeddings' if embedder
      capabilities
    end
  end

  def requires_secret?
    requires_secret
  end

  def uses_api_version?
    API_VERSION_SERVICES.include?(key)
  end

  def check_path
    CHECK_PATHS[key]
  end

  def check_headers
    CHECK_HEADERS.fetch(key, {})
  end

  # What the connection form's script needs when this service is picked.
  def to_preset
    {
      label:            label,
      base_url:         default_base_url,
      auth_scheme:      auth_scheme,
      auth_header:      auth_header,
      requires_secret:  requires_secret?,
      uses_api_version: uses_api_version?,
      api_version:      default_api_version,
      capabilities:     capabilities,
    }
  end
end
