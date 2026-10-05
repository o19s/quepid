# frozen_string_literal: true

# One vendor an Embedder can be pointed at, and the registry of all of them.
#
# Like LlmProvider, not an ActiveRecord model: the set of providers is code, not data.
# An embedder stores only the provider's `key`, and everything the app knows about that
# provider -- what it can do and how to talk to it -- is looked up here. Single source of
# truth for the provider dropdown, the fields the embedder form shows, and the validations
# in Embedder: adding a provider means adding an entry to DEFINITIONS (and an adapter in
# app/services/embedder_adapters/ if it doesn't speak an existing dialect).
class EmbedderProvider
  include ActiveModel::Model
  include ActiveModel::Attributes

  # How instruction-following embedding models (Qwen3-Embedding, E5-instruct, GTE) expect a
  # query: the task description and the query in one string. Instructions are not an API
  # parameter for any provider here -- the adapter renders this template client-side.
  DEFAULT_INPUT_TEMPLATE = "Instruct: {instruction}\nQuery: {query}"

  # Filled into the Ollama entry by .all -- see runtime_settings.
  OLLAMA_HELP_HTML = <<~HTML.squish
    <strong>Ollama</strong> &mdash; Local embedding models via the Ollama container.<br>
    <b>URL:</b> <code>%<url>s</code><br>
    <b>Model:</b> e.g. <code>qwen3-embedding:0.6b</code>, <code>nomic-embed-text</code>,
    <code>mxbai-embed-large</code><br>
    <b>Key:</b> Leave blank -- Ollama doesn't check one<br>
    <b>Dimensions:</b> sent as <code>dimensions</code> to <code>/api/embed</code>; needs a recent Ollama
    and a model that supports it. Otherwise use client-side truncation for Matryoshka models.
  HTML

  attribute :key,                          :string
  # Shown in the embedder form's provider dropdown.
  attribute :label,                        :string
  # The EmbedderAdapters class that speaks this vendor's dialect.
  attribute :adapter,                      :string
  # Filled into the form when this provider is picked.
  attribute :default_service_url,          :string
  attribute :default_model,                :string
  # How the API key is sent: :bearer, or :none for providers that never take one.
  attribute :auth_style,                   default: :bearer
  # Whether the vendor rejects every request without a key, so an embedder can't be
  # saved without one. Self-hosted servers (Ollama, vLLM, TEI) often run without.
  attribute :requires_key,                 :boolean, default: false
  # Whether the API takes a requested output size. Drives whether `native` truncation is
  # offered; `client` truncation is always available.
  attribute :supports_dimensions,          :boolean, default: false
  # When the API only accepts some sizes, the list; empty means any positive size.
  attribute :allowed_dimensions,           default: -> { [] }
  # Whether the form offers an instruction and input template.
  attribute :supports_instructions,        :boolean, default: false
  # Upper bound on texts per request; the adapter splits larger inputs into batches.
  attribute :max_batch_size,               :integer, default: 64
  # Provider guidance rendered into the form's help panel.
  attribute :help_html,                    :string

  DEFINITIONS = [
    {
      key:                 'openai',
      label:               'OpenAI',
      adapter:             'EmbedderAdapters::OpenAi',
      default_service_url: 'https://api.openai.com',
      default_model:       'text-embedding-3-small',
      requires_key:        true,
      supports_dimensions: true,
      max_batch_size:      2048,
      help_html:           <<~HTML.squish,
        <strong>OpenAI</strong> &mdash; <code>POST /v1/embeddings</code>.<br>
        <b>URL:</b> <code>https://api.openai.com</code><br>
        <b>Model:</b> e.g. <code>text-embedding-3-small</code> (1536), <code>text-embedding-3-large</code> (3072)<br>
        <b>Key:</b> Your OpenAI API key (starts with <code>sk-</code>)<br>
        <b>Dimensions:</b> only the <code>text-embedding-3-*</code> models accept a smaller size.
      HTML
    },
    {
      key:                 'voyage',
      label:               'Voyage AI',
      adapter:             'EmbedderAdapters::Voyage',
      default_service_url: 'https://api.voyageai.com',
      default_model:       'voyage-3.5',
      requires_key:        true,
      supports_dimensions: true,
      allowed_dimensions:  [ 256, 512, 1024, 2048 ],
      max_batch_size:      1000,
      help_html:           <<~HTML.squish,
        <strong>Voyage AI</strong> &mdash; <code>POST /v1/embeddings</code>, sent with
        <code>input_type: "query"</code>.<br>
        <b>URL:</b> <code>https://api.voyageai.com</code><br>
        <b>Model:</b> e.g. <code>voyage-3.5</code>, <code>voyage-3-large</code>, <code>voyage-3.5-lite</code><br>
        <b>Key:</b> Your Voyage API key<br>
        <b>Dimensions:</b> 256, 512, 1024 or 2048 on models that support <code>output_dimension</code>.
      HTML
    },
    # URL and help text come from config at lookup time -- see runtime_settings.
    {
      key:                   'ollama',
      label:                 'Ollama',
      adapter:               'EmbedderAdapters::Ollama',
      default_model:         'qwen3-embedding:0.6b',
      auth_style:            :none,
      supports_dimensions:   true,
      supports_instructions: true,
    },
    {
      key:                   'openai_compatible',
      label:                 'OpenAI-compatible',
      adapter:               'EmbedderAdapters::OpenAi',
      default_service_url:   '',
      default_model:         '',
      supports_dimensions:   true,
      supports_instructions: true,
      help_html:             <<~HTML.squish,
        <strong>OpenAI-compatible</strong> &mdash; Any server exposing <code>POST /v1/embeddings</code>
        (vLLM, Text Embeddings Inference, LM Studio, LiteLLM, ...).<br>
        <b>URL:</b> The server's base URL, without <code>/v1/embeddings</code><br>
        <b>Model:</b> The model name the server expects<br>
        <b>Key:</b> Sent as a Bearer token if set<br>
        <b>Dimensions:</b> Sent as <code>dimensions</code>; whether it is honoured depends on the server.
      HTML
    }
  ].freeze

  class << self
    # Built on each call rather than once, because the Ollama entry depends on
    # Rails.configuration, which tests and deployments override.
    def all
      DEFINITIONS.map { |definition| new(definition.merge(runtime_settings(definition[:key]))) }
    end

    def find key
      all.find { |provider| provider.key == key.to_s }
    end

    def keys
      DEFINITIONS.pluck(:key)
    end

    # [[label, key], ...] for options_for_select
    def select_options
      all.map { |provider| [ provider.label, provider.key ] }
    end

    def presets
      all.index_by(&:key).transform_values(&:to_preset)
    end

    private

    # The one entry DEFINITIONS can't spell out: Ollama's URL is deployment config.
    def runtime_settings key
      return {} unless 'ollama' == key

      url = Rails.configuration.ollama_service_url
      { default_service_url: url, help_html: format(OLLAMA_HELP_HTML, url: ERB::Util.html_escape(url)) }
    end
  end

  # ActiveModel attributes get no `?` reader of their own.
  def supports_dimensions?
    supports_dimensions
  end

  def supports_instructions?
    supports_instructions
  end

  def requires_key?
    requires_key
  end

  def adapter_class
    adapter.constantize
  end

  # The shape the embedder form (embedder_form_controller.js) expects for presets[key].
  def to_preset
    {
      label:                 label,
      service_url:           default_service_url,
      model:                 default_model,
      help:                  help_html,
      supports_dimensions:   supports_dimensions?,
      allowed_dimensions:    allowed_dimensions,
      supports_instructions: supports_instructions?,
      uses_key:              :none != auth_style,
      requires_key:          requires_key?,
    }
  end
end
