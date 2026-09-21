# frozen_string_literal: true

# The registry of LLM vendors AI Judges can use.
#
# Single source of truth for the provider dropdown and the preset/help panel in
# app/views/ai_judges/_form.html.erb. Adding a provider means adding an entry here.
#
# Built on each call rather than frozen into a constant because one entry (ollama)
# depends on Rails.configuration, which tests and deployments override.
#
# rubocop:disable Metrics/ModuleLength -- a registry is long by nature; same reason
# Metrics/ClassLength is off repo-wide.
module LlmProviders
  class << self
    def all
      [
        openai, azure_openai, azure_ai_foundry, azure_ai_foundry_serverless,
        azure_ai_foundry_anthropic, anthropic, google_gemini, ollama, typesafe_jev
      ]
    end

    def [] key
      all.find { |provider| provider.key == key.to_s }
    end

    def keys
      all.map(&:key)
    end

    def each(&)
      all.each(&)
    end

    # [[label, key], ...] for options_for_select
    def select_options
      all.map(&:to_select_option)
    end

    # Providers listed in the form that Quepid cannot judge with yet.
    def coming_soon
      all.select(&:coming_soon?)
    end

    def presets
      all.index_by(&:key).transform_values(&:to_preset)
    end

    # Safe to interpolate into a <script> tag: ActiveSupport escapes HTML entities
    # (including any "</script>") as \u-escapes when serializing to JSON.
    def presets_json
      presets.to_json
    end

    private

    def openai
      LlmProvider.new(
        key:                 'openai',
        label:               'OpenAI',
        default_service_url: 'https://api.openai.com',
        default_model:       'gpt-4o',
        help_html:           '<strong>OpenAI</strong> &mdash; Direct API access.<br>' \
                             '<b>URL:</b> <code>https://api.openai.com</code><br>' \
                             '<b>Model:</b> e.g. <code>gpt-4o</code>, <code>gpt-4.1</code><br>' \
                             '<b>Key:</b> Your OpenAI API key (starts with <code>sk-</code>)<br>' \
                             '<b>API Version:</b> Leave blank'
      )
    end

    def azure_openai
      LlmProvider.new(
        key:                 'azure_openai',
        label:               'Azure OpenAI',
        default_service_url: 'https://RESOURCE.openai.azure.com',
        default_model:       'gpt-4.1',
        help_html:           '<strong>Azure OpenAI</strong> &mdash; OpenAI models hosted on Azure.<br>' \
                             '<b>URL:</b> <code>https://YOUR-RESOURCE.openai.azure.com</code><br>' \
                             '<b>Model:</b> Your deployment name, e.g. <code>gpt-4.1</code>, ' \
                             '<code>gpt-5.1</code><br>' \
                             '<b>Key:</b> Azure resource API key<br>' \
                             '<b>API Version:</b> Set to use deployment-based routing ' \
                             '(e.g. <code>2024-12-01-preview</code>), or leave blank for ' \
                             '<code>/openai/v1/</code> path'
      )
    end

    def azure_ai_foundry
      LlmProvider.new(
        key:                 'azure_ai_foundry',
        label:               'Azure AI Foundry',
        default_service_url: 'https://RESOURCE.services.ai.azure.com',
        default_api_version: '2025-01-01-preview',
        default_model:       'gpt-4o',
        help_html:           '<strong>Azure AI Foundry</strong> &mdash; Unified Azure AI endpoint.<br>' \
                             '<b>URL:</b> <code>https://YOUR-RESOURCE.services.ai.azure.com</code><br>' \
                             '<b>Model:</b> Model name, e.g. <code>gpt-4o</code><br>' \
                             '<b>Key:</b> Azure AI services key<br>' \
                             '<b>API Version:</b> Defaults to <code>2025-01-01-preview</code>'
      )
    end

    def azure_ai_foundry_serverless
      LlmProvider.new(
        key:                 'azure_ai_foundry_serverless',
        label:               'Azure AI Foundry (Serverless)',
        default_service_url: 'https://MODEL-NAME.REGION.models.ai.azure.com',
        default_model:       '',
        help_html:           '<strong>Azure AI Foundry (Serverless)</strong> &mdash; ' \
                             'Models-as-a-Service pay-per-token endpoint.<br>' \
                             '<b>URL:</b> <code>https://MODEL-NAME.REGION.models.ai.azure.com</code><br>' \
                             '<b>Model:</b> Model name from the deployment<br>' \
                             '<b>Key:</b> Serverless endpoint key<br>' \
                             '<b>API Version:</b> Leave blank'
      )
    end

    def azure_ai_foundry_anthropic
      LlmProvider.new(
        key:                 'azure_ai_foundry_anthropic',
        label:               'Azure AI Foundry (Anthropic)',
        default_service_url: 'https://RESOURCE.services.ai.azure.com/anthropic',
        default_model:       'claude-3-5-haiku-20241022',
        help_html:           '<strong>Azure AI Foundry (Anthropic)</strong> &mdash; Claude models via ' \
                             'Azure using the native Anthropic Messages API.<br>' \
                             '<b>URL:</b> <code>https://YOUR-RESOURCE.services.ai.azure.com/anthropic</code><br>' \
                             '<b>Model:</b> e.g. <code>claude-3-5-haiku-20241022</code><br>' \
                             '<b>Key:</b> Azure AI services key (sent as <code>x-api-key</code> header)<br>' \
                             '<b>API Version:</b> Leave blank (the <code>anthropic-version</code> header ' \
                             'is set automatically)'
      )
    end

    def anthropic
      LlmProvider.new(
        key:                 'anthropic',
        label:               'Anthropic',
        default_service_url: 'https://api.anthropic.com',
        default_model:       'claude-sonnet-4-5-20250514',
        help_html:           '<strong>Anthropic</strong> &mdash; Direct Anthropic API access.<br>' \
                             '<b>URL:</b> <code>https://api.anthropic.com</code><br>' \
                             '<b>Model:</b> e.g. <code>claude-opus-4-6</code>, ' \
                             '<code>claude-sonnet-4-5-20250514</code><br>' \
                             '<b>Key:</b> Your Anthropic API key (sent as <code>x-api-key</code> header)<br>' \
                             '<b>API Version:</b> Leave blank'
      )
    end

    def google_gemini
      LlmProvider.new(
        key:                 'google_gemini',
        label:               'Google Gemini',
        default_service_url: 'https://generativelanguage.googleapis.com/v1beta/openai',
        default_model:       'gemini-2.0-flash',
        help_html:           '<strong>Google Gemini</strong> &mdash; Uses the OpenAI-compatible endpoint.<br>' \
                             '<b>URL:</b> <code>https://generativelanguage.googleapis.com/v1beta/openai' \
                             '</code><br>' \
                             '<b>Model:</b> e.g. <code>gemini-2.0-flash</code><br>' \
                             '<b>Key:</b> Your Google AI API key<br>' \
                             '<b>API Version:</b> Leave blank'
      )
    end

    # Placeholder entry: Jev is a typed "System One" model, not a chat model, so it needs
    # its own adapter before a judging run can use it (docs/adr/0001, docs/todo/jev_llm_judge.md).
    # It is listed now so teams can see what it will need -- an API key -- and get one;
    # AiJudgesController refuses to save a judge pointed at it until the adapter lands.
    def typesafe_jev
      LlmProvider.new(
        key:                 'typesafe_jev',
        label:               'TypeSafe Jev (coming soon)',
        default_service_url: 'https://api.typesafe.ai',
        default_model:       'jev-latest',
        read_only_fields:    %w[llm_service_url llm_model llm_api_version],
        notice_html:         '<strong>Coming soon.</strong> Quepid cannot judge with Jev yet &mdash; ' \
                             'support is still being built, so this provider cannot be saved.<br>' \
                             'To get ready, create an account and an API key at ' \
                             '<a href="https://console.typesafe.ai/keys" target="_blank" rel="noopener">' \
                             'console.typesafe.ai/keys</a> and paste it into <b>LLM Key</b> above.',
        help_html:           '<strong>TypeSafe Jev (coming soon)</strong> &mdash; Typed evaluation model: ' \
                             'it returns a rating with a probability distribution instead of text.<br>' \
                             '<b>URL:</b> <code>https://api.typesafe.ai</code> (fixed)<br>' \
                             '<b>Model:</b> <code>jev-latest</code> (fixed)<br>' \
                             '<b>Key:</b> Your TypeSafe API key from ' \
                             '<code>console.typesafe.ai/keys</code><br>' \
                             '<b>API Version:</b> Not used<br>' \
                             'The book\'s rating scale and labels become the judging criteria, so the ' \
                             'system prompt matters less than it does for a chat model. Text only &mdash; ' \
                             'document images are ignored.'
      )
    end

    def ollama
      url = Rails.configuration.ollama_service_url

      LlmProvider.new(
        key:                 'ollama',
        label:               'Ollama',
        default_service_url: url,
        default_model:       'qwen3:0.6b',
        help_html:           '<strong>Ollama</strong> &mdash; Local models via the Ollama container.<br>' \
                             "<b>URL:</b> <code>#{ERB::Util.html_escape(url)}</code><br>" \
                             '<b>Model:</b> e.g. <code>qwen3:0.6b</code>, <code>llama3</code><br>' \
                             '<b>Key:</b> Any placeholder value (e.g. <code>abc123</code>)<br>' \
                             '<b>API Version:</b> Leave blank'
      )
    end
  end
end
# rubocop:enable Metrics/ModuleLength
