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
  # What a chat-completions judge is told: the rating scale it should use, the
  # JSON shape to answer in, and worked examples -- all of which a chat model
  # needs because none of it is part of the request otherwise.
  CHAT_SYSTEM_PROMPT = <<~TEXT
    You are evaluating the results from a search engine. For each query, you will be provided with multiple documents. Your task is to evaluate each document and assign a judgment on a scale of 0 to 3, where:
    - 0 indicates the document is irrelevant to the query.
    - 1 indicates the document is somewhat relevant to the query.
    - 2 indicates the document is mostly relevant to the query.
    - 3 indicates the document is perfectly relevant to the query.

    For each document, provide:
    1. An explanation of the judgment.
    2. The judgment value.

    The response should be in the following JSON format:
    {
      "explanation": "Your detailed reasoning behind the judgment",
      "judgment": <numeric value>
    }

    Here is an example:
    User:
    Query: Farm animals

    doc1:
      title: All about farm animals
      abstract: This document is all about farm animals
    Assistant:
    {
      "explanation": "This document appears to perfectly respond to the user's query",
      "judgment": 3
    }

    User:
    Query: Farm animals

    doc2:
      title: Somewhat about farm animals
      abstract: This document somewhat talks about farm animals
    Assistant:
    {
      "explanation": "This document is somewhat relevant to the user's query",
      "judgment": 1
    }

    User:
    Query: Farm animals

    doc3:
      title: This document has nothing to do with farm animals
      abstract: We will talk about everything except for farm animals.
    Assistant:
    {
      "explanation": "This document is not relevant at all to the user's query",
      "judgment": 0
    }
  TEXT

  # Jev needs almost none of that. The scale, its labels and the answer's shape
  # are carried by the request itself, so instructions that repeat them only
  # contradict the book (the stock prompt hardcodes 0-3) and spend tokens. What
  # is left worth saying is what to weigh.
  JEV_SYSTEM_PROMPT = <<~TEXT
    Judge how well the document satisfies the user's query and, when one is given, the stated information need.

    Weigh what the document is actually about and how specific it is to the query -- not its length, style or formatting. A document that merely mentions the query's words without addressing it is not relevant.

    The rating scale and the meaning of each rating come from the book and are sent with this request; rate against those, and say nothing about output format.
  TEXT

  # Long enough to crowd the registry entry it belongs to.
  JEV_HELP_HTML = '<strong>TypeSafe Jev</strong> &mdash; A typed evaluation model rather than a ' \
                  'chat model: it answers with a rating, a probability distribution and a ' \
                  'confidence, and cannot return a rating outside your scale.<br>' \
                  '<b>URL:</b> <code>https://api.typesafe.ai</code> (fixed)<br>' \
                  '<b>Model:</b> <code>jev-latest</code> (fixed)<br>' \
                  '<b>Key:</b> Your TypeSafe API key from ' \
                  '<a href="https://console.typesafe.ai/keys" target="_blank" rel="noopener">' \
                  'console.typesafe.ai/keys</a><br>' \
                  '<b>API Version:</b> Not used<br>' \
                  'The book\'s rating scale and labels become the question\'s criteria, so a Jev ' \
                  'judge must be run from a book, and the text below is sent as that ' \
                  'question\'s instructions &mdash; not as a system prompt. It writes no ' \
                  'prose, so the ' \
                  'explanation Quepid stores is built from the score, confidence and ' \
                  'distribution. Text only &mdash; document images are ignored.'

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

    # Every option a provider declares, keyed by option name, each carrying the provider
    # that owns it -- so the form can render a declared widget whether or not the judge
    # has that option saved yet.
    def option_field_specs
      all.each_with_object({}) do |provider, specs|
        provider.option_fields.each { |key, field| specs[key.to_s] = field.merge(provider: provider.key) }
      end
    end

    # Every prompt the app ships. The AI Judge form uses this to tell a prompt
    # nobody has touched from one somebody wrote, so switching provider can
    # offer the right default without ever clobbering real work.
    def stock_system_prompts
      all.filter_map(&:default_system_prompt).uniq
    end

    def stock_system_prompts_json
      stock_system_prompts.to_json
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
        auth_style:          :api_key,
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
        auth_style:          :api_key,
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
        auth_style:          :api_key,
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
        adapter:             'LlmJudgeAdapters::Anthropic',
        auth_style:          :x_api_key,
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
        adapter:             'LlmJudgeAdapters::Anthropic',
        auth_style:          :x_api_key,
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
        key:                   'typesafe_jev',
        scale_as_criteria:     true,
        option_fields:         {
          'jev_min_confidence' => {
            label: 'Minimum confidence',
            type:  :number,
            min:   0,
            max:   1,
            step:  0.1,
            hint:  'Optional, 0 to 1. Jev reports how concentrated its answer is; below this ' \
                   'the judgement is marked unrateable instead of rated, with the numbers kept ' \
                   'in the explanation. Leave blank to accept every answer.',
          },
        },
        adapter:               'LlmJudgeAdapters::Jev',
        default_system_prompt: JEV_SYSTEM_PROMPT,
        prompt_label:          'Judging instructions',
        prompt_hint:           'Jev has no system prompt: this text is sent as the instructions on the ' \
                               'question it is asked. Say what to weigh -- the rating scale, its labels ' \
                               'and the shape of the answer are part of the request already.',
        label:                 'TypeSafe Jev',
        default_service_url:   'https://api.typesafe.ai',
        default_model:         'jev-latest',
        read_only_fields:      %w[llm_service_url llm_model llm_api_version],
        help_html:             JEV_HELP_HTML
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
