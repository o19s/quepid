# frozen_string_literal: true

# One LLM vendor an AI Judge can be pointed at, and the registry of all of them.
#
# Not an ActiveRecord model: the set of providers is code, not data. A judge stores
# only the provider's `key` in its `judge_options[:llm_provider]`, and everything the
# app knows about that provider is looked up here. Single source of truth for the
# provider dropdown and the preset/help panel in app/views/ai_judges/_form.html.erb:
# adding a provider means adding an entry to DEFINITIONS.
class LlmProvider
  include ActiveModel::Model
  include ActiveModel::Attributes

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

  # Jev needs almost none of that. Its rating scale comes from the book
  # (Book#scale / #scale_with_labels, copied from a scorer, via JudgeScale) and is
  # sent as the question's `criteria` by LlmJudgeAdapters::Jev -- so the prompt
  # must not restate it: CHAT_SYSTEM_PROMPT's hardcoded 0-3 would contradict any
  # book on a different scale. What is left worth saying is what to weigh.
  JEV_SYSTEM_PROMPT = <<~TEXT
    Judge how well the document satisfies the user's query and, when one is given, the stated information need.

    Weigh what the document is actually about and how specific it is to the query -- not its length, style or formatting. A document that merely mentions the query's words without addressing it is not relevant.

    The rating scale and the meaning of each rating come from the book and are sent with this request; rate against those, and say nothing about output format.
  TEXT

  # Long enough to crowd the registry entry it belongs to.
  JEV_HELP_HTML = <<~HTML.squish
    <strong>TypeSafe Jev</strong> &mdash; A typed evaluation model rather than a
    chat model: it answers with a rating, a probability distribution and a
    confidence, and cannot return a rating outside your scale.<br>
    <b>URL:</b> <code>https://api.typesafe.ai</code> (fixed)<br>
    <b>Model:</b> <code>jev-latest</code> (fixed)<br>
    <b>Key:</b> Your TypeSafe API key from
    <a href="https://console.typesafe.ai/keys" target="_blank" rel="noopener">console.typesafe.ai/keys</a><br>
    <b>API Version:</b> Not used<br>
    The book's rating scale and labels become the question's criteria, so a Jev
    judge must be run from a book, and the text below is sent as that
    question's instructions &mdash; not as a system prompt. It writes no prose,
    so the explanation Quepid stores is built from the score, confidence and
    distribution. Text only &mdash; document images are ignored.
  HTML

  # Filled into the Ollama entry by .all -- see runtime_settings.
  OLLAMA_HELP_HTML = <<~HTML.squish
    <strong>Ollama</strong> &mdash; Local models via the Ollama container.<br>
    <b>URL:</b> <code>%<url>s</code><br>
    <b>Model:</b> e.g. <code>qwen3:0.6b</code>, <code>llama3</code><br>
    <b>Key:</b> Leave blank -- Ollama doesn't check one<br>
    <b>API Version:</b> Leave blank
  HTML

  # Value stored in judge_options[:llm_provider].
  attribute :key,                   :string
  # Shown in the AI Judge form's provider dropdown.
  attribute :label,                 :string
  # Filled into the form when this provider is picked.
  attribute :default_service_url,   :string
  attribute :default_model,         :string
  # Blank for providers that don't use one.
  attribute :default_api_version,   :string, default: ''
  # Provider guidance rendered into the form's help panel.
  attribute :help_html,             :string
  # A warning banner shown above the help panel, for a provider Quepid cannot judge
  # with yet -- see coming_soon?.
  attribute :notice_html,           :string
  # judge_options fields the form locks for this provider, for settings the vendor
  # fixes rather than the team choosing.
  attribute :read_only_fields,      default: -> { [] }
  # The LlmJudgeAdapters class that speaks this vendor's dialect.
  attribute :adapter,               :string, default: LlmJudgeAdapters::DEFAULT_ADAPTER
  # How the API key is sent: :bearer, :api_key or :x_api_key.
  attribute :auth_style,            default: :bearer
  # What a new judge on this provider is told, and what the form offers when switching
  # to it -- a chat model needs the scale and an output format spelled out, a typed
  # model does not.
  attribute :default_system_prompt, :string, default: CHAT_SYSTEM_PROMPT
  # What the form calls that text: a system prompt to a chat model, but instructions
  # on a question to a typed one.
  attribute :prompt_label,          :string, default: 'System prompt'
  # One line under the field explaining what belongs in it.
  attribute :prompt_hint,           :string
  # True when this provider is sent the book's scale as the question's criteria rather
  # than having it described in prose inside the prompt.
  attribute :scale_as_criteria,     :boolean, default: false
  # judge_options this provider understands beyond the common ones, as
  # key => { label:, hint:, ... }, so the form can offer them instead of leaving
  # people to hand-edit JSON.
  attribute :option_fields,         default: -> { {} }

  DEFINITIONS = [
    {
      key:                 'openai',
      label:               'OpenAI',
      default_service_url: 'https://api.openai.com',
      default_model:       'gpt-4o',
      help_html:           <<~HTML.squish,
        <strong>OpenAI</strong> &mdash; Direct API access.<br>
        <b>URL:</b> <code>https://api.openai.com</code><br>
        <b>Model:</b> e.g. <code>gpt-4o</code>, <code>gpt-4.1</code><br>
        <b>Key:</b> Your OpenAI API key (starts with <code>sk-</code>)<br>
        <b>API Version:</b> Leave blank
      HTML
    },
    {
      key:                 'azure_openai',
      label:               'Azure OpenAI',
      auth_style:          :api_key,
      default_service_url: 'https://RESOURCE.openai.azure.com',
      default_model:       'gpt-4.1',
      help_html:           <<~HTML.squish,
        <strong>Azure OpenAI</strong> &mdash; OpenAI models hosted on Azure.<br>
        <b>URL:</b> <code>https://YOUR-RESOURCE.openai.azure.com</code><br>
        <b>Model:</b> Your deployment name, e.g. <code>gpt-4.1</code>, <code>gpt-5.1</code><br>
        <b>Key:</b> Azure resource API key<br>
        <b>API Version:</b> Set to use deployment-based routing
        (e.g. <code>2024-12-01-preview</code>), or leave blank for <code>/openai/v1/</code> path
      HTML
    },
    {
      key:                 'azure_ai_foundry',
      label:               'Azure AI Foundry',
      auth_style:          :api_key,
      default_service_url: 'https://RESOURCE.services.ai.azure.com',
      default_api_version: '2025-01-01-preview',
      default_model:       'gpt-4o',
      help_html:           <<~HTML.squish,
        <strong>Azure AI Foundry</strong> &mdash; Unified Azure AI endpoint.<br>
        <b>URL:</b> <code>https://YOUR-RESOURCE.services.ai.azure.com</code><br>
        <b>Model:</b> Model name, e.g. <code>gpt-4o</code><br>
        <b>Key:</b> Azure AI services key<br>
        <b>API Version:</b> Defaults to <code>2025-01-01-preview</code>
      HTML
    },
    {
      key:                 'azure_ai_foundry_serverless',
      label:               'Azure AI Foundry (Serverless)',
      auth_style:          :api_key,
      default_service_url: 'https://MODEL-NAME.REGION.models.ai.azure.com',
      default_model:       '',
      help_html:           <<~HTML.squish,
        <strong>Azure AI Foundry (Serverless)</strong> &mdash;
        Models-as-a-Service pay-per-token endpoint.<br>
        <b>URL:</b> <code>https://MODEL-NAME.REGION.models.ai.azure.com</code><br>
        <b>Model:</b> Model name from the deployment<br>
        <b>Key:</b> Serverless endpoint key<br>
        <b>API Version:</b> Leave blank
      HTML
    },
    {
      key:                 'azure_ai_foundry_anthropic',
      label:               'Azure AI Foundry (Anthropic)',
      adapter:             'LlmJudgeAdapters::Anthropic',
      auth_style:          :x_api_key,
      default_service_url: 'https://RESOURCE.services.ai.azure.com/anthropic',
      default_model:       'claude-3-5-haiku-20241022',
      help_html:           <<~HTML.squish,
        <strong>Azure AI Foundry (Anthropic)</strong> &mdash; Claude models via
        Azure using the native Anthropic Messages API.<br>
        <b>URL:</b> <code>https://YOUR-RESOURCE.services.ai.azure.com/anthropic</code><br>
        <b>Model:</b> e.g. <code>claude-3-5-haiku-20241022</code><br>
        <b>Key:</b> Azure AI services key (sent as <code>x-api-key</code> header)<br>
        <b>API Version:</b> Leave blank (the <code>anthropic-version</code> header is set automatically)
      HTML
    },
    {
      key:                 'anthropic',
      label:               'Anthropic',
      adapter:             'LlmJudgeAdapters::Anthropic',
      auth_style:          :x_api_key,
      default_service_url: 'https://api.anthropic.com',
      default_model:       'claude-sonnet-4-5-20250514',
      help_html:           <<~HTML.squish,
        <strong>Anthropic</strong> &mdash; Direct Anthropic API access.<br>
        <b>URL:</b> <code>https://api.anthropic.com</code><br>
        <b>Model:</b> e.g. <code>claude-opus-4-6</code>, <code>claude-sonnet-4-5-20250514</code><br>
        <b>Key:</b> Your Anthropic API key (sent as <code>x-api-key</code> header)<br>
        <b>API Version:</b> Leave blank
      HTML
    },
    {
      key:                 'google_gemini',
      label:               'Google Gemini',
      default_service_url: 'https://generativelanguage.googleapis.com/v1beta/openai',
      default_model:       'gemini-2.0-flash',
      help_html:           <<~HTML.squish,
        <strong>Google Gemini</strong> &mdash; Uses the OpenAI-compatible endpoint.<br>
        <b>URL:</b> <code>https://generativelanguage.googleapis.com/v1beta/openai</code><br>
        <b>Model:</b> e.g. <code>gemini-2.0-flash</code><br>
        <b>Key:</b> Your Google AI API key<br>
        <b>API Version:</b> Leave blank
      HTML
    },
    # URL and help text come from config at lookup time -- see runtime_settings.
    {
      key:           'ollama',
      label:         'Ollama',
      default_model: 'qwen3:0.6b',
    },
    # Jev is a typed "System One" model, not a chat model, so it speaks through its own
    # adapter (LlmJudgeAdapters::Jev; docs/adr/0001). scale_as_criteria makes it need a
    # book: without one there is no scale to send, so AiJudges::WizardController and the
    # form refuse to preview it and a judging run can only start from a book.
    {
      key:                   'typesafe_jev',
      label:                 'TypeSafe Jev',
      adapter:               'LlmJudgeAdapters::Jev',
      default_service_url:   'https://api.typesafe.ai',
      default_model:         'jev-latest',
      read_only_fields:      %w[llm_service_url llm_model llm_api_version],
      scale_as_criteria:     true,
      default_system_prompt: JEV_SYSTEM_PROMPT,
      prompt_label:          'Judging instructions',
      prompt_hint:           'Jev has no system prompt: this text is sent as the instructions on the ' \
                             'question it is asked. Say what to weigh -- the rating scale, its labels ' \
                             'and the shape of the answer are part of the request already.',
      help_html:             JEV_HELP_HTML,
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

    # Not just indirection: `LlmProvider.all.each` reads to Rails/FindEach like an
    # ActiveRecord relation and gets flagged.
    def each(&)
      all.each(&)
    end

    # [[label, key], ...] for options_for_select
    def select_options
      all.map { |provider| [ provider.label, provider.key ] }
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

    private

    # The one entry DEFINITIONS can't spell out: Ollama's URL is deployment config.
    def runtime_settings key
      return {} unless 'ollama' == key

      url = Rails.configuration.ollama_service_url
      { default_service_url: url, help_html: format(OLLAMA_HELP_HTML, url: ERB::Util.html_escape(url)) }
    end
  end

  alias_method :scale_as_criteria?, :scale_as_criteria

  # A provider that is sent the book's scale as its criteria has nothing to judge
  # against without one, so it can only be run (or previewed) from a book.
  def needs_book?
    scale_as_criteria?
  end

  # True for a provider that is visible in the form but that Quepid cannot actually
  # judge with yet -- selecting it shows `notice_html` and saving is refused.
  def coming_soon?
    notice_html.present?
  end

  # Is this text one of the prompts Quepid ships for some *other* provider? That is a
  # judge carrying instructions written for a different kind of model -- worth flagging,
  # unlike text somebody wrote themselves, which is none of our business.
  def stock_prompt_from_another_provider? text
    return false if text.blank? || default_system_prompt.blank?

    # A textarea posts CRLF, so stored text never matches a heredoc byte for byte.
    text = normalize(text)
    return false if text == normalize(default_system_prompt)

    self.class.stock_system_prompts.any? { |prompt| normalize(prompt) == text }
  end

  # The shape the AI Judge wizard (ai_judge_wizard_controller.js) expects for presets[key].
  def to_preset
    {
      llm_service_url:   default_service_url,
      llm_api_version:   default_api_version,
      llm_model:         default_model,
      help:              help_html,
      notice:            notice_html,
      read_only:         read_only_fields,
      system_prompt:     default_system_prompt,
      prompt_label:      prompt_label,
      prompt_hint:       prompt_hint,
      scale_as_criteria: scale_as_criteria?,
      needs_book:        needs_book?,
    }
  end

  private

  def normalize text
    text.to_s.gsub(/\r\n?/, "\n").strip
  end
end
