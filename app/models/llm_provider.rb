# frozen_string_literal: true

# One LLM vendor an AI Judge can be pointed at.
#
# Not an ActiveRecord model: the set of providers is code, not data. A judge stores
# only the provider's `key` in its `judge_options[:llm_provider]`, and everything the
# app knows about that provider is looked up here -- see LlmProviders.
class LlmProvider
  attr_reader :key, :label, :default_service_url, :default_api_version, :default_model,
              :help_html, :notice_html, :read_only_fields, :adapter, :auth_style,
              :default_system_prompt, :prompt_label, :prompt_hint, :option_fields

  # @param key [String] value stored in judge_options[:llm_provider]
  # @param label [String] shown in the AI Judge form's provider dropdown
  # @param default_service_url [String] filled into the form when this provider is picked
  # @param default_model [String] ditto
  # @param help_html [String] provider guidance rendered into the form's help panel
  # @param default_api_version [String] ditto; blank for providers that don't use one
  # @param notice_html [String, nil] a warning banner shown above the help panel, e.g. for a
  #   provider Quepid cannot judge with yet
  # @param read_only_fields [Array<String>] judge_options fields the form locks for this
  #   provider, for settings the vendor fixes rather than the team choosing
  # @param adapter [String, nil] name of the LlmJudgeAdapters class that speaks this
  #   vendor's dialect; nil for a provider with no adapter yet
  # @param auth_style [Symbol] how the API key is sent: :bearer, :api_key or :x_api_key
  # @param default_system_prompt [String] what a new judge on this provider is told, and
  #   what the form offers when switching to it -- a chat model needs the scale and an
  #   output format spelled out, a typed model does not
  # @param prompt_label [String] what the form calls that text for this provider; it is a
  #   system prompt to a chat model, but instructions on a question to a typed one
  # @param prompt_hint [String, nil] one line under the field explaining what belongs in it
  # @param option_fields [Hash] judge_options this provider understands beyond the common
  #   ones, as key => { label:, hint: }, so the form can offer them instead of leaving
  #   people to hand-edit JSON
  # rubocop:disable-next Metrics/ParameterLists -- keyword arguments, all of them required data
  def initialize(key:, label:, default_service_url:, default_model:, help_html:,
                 default_api_version: '', notice_html: nil, read_only_fields: [],
                 adapter: LlmJudgeAdapters::DEFAULT_ADAPTER, auth_style: :bearer,
                 default_system_prompt: LlmProviders::CHAT_SYSTEM_PROMPT,
                 prompt_label: 'System prompt', prompt_hint: nil, scale_as_criteria: false,
                 option_fields: {})
    @key = key.to_s
    @label = label
    @default_service_url = default_service_url
    @default_api_version = default_api_version
    @default_model = default_model
    @help_html = help_html
    @notice_html = notice_html
    @read_only_fields = read_only_fields.map(&:to_s).freeze
    @adapter = adapter
    @auth_style = auth_style
    @default_system_prompt = default_system_prompt
    @prompt_label = prompt_label
    @prompt_hint = prompt_hint
    @scale_as_criteria = scale_as_criteria
    @option_fields = option_fields.freeze

    freeze
  end

  # Is this text one of the prompts Quepid ships for some *other* provider? That is a
  # judge carrying instructions written for a different kind of model -- worth flagging,
  # unlike text somebody wrote themselves, which is none of our business.
  def stock_prompt_from_another_provider? text
    return false if text.blank? || default_system_prompt.blank?

    # A textarea posts CRLF, so stored text never matches a heredoc byte for byte.
    text = normalize(text)
    return false if text == normalize(default_system_prompt)

    LlmProviders.stock_system_prompts.any? { |prompt| normalize(prompt) == text }
  end

  # True when this provider sends the book's scale as the question's criteria rather
  # than describing it in prose inside the prompt.
  def scale_as_criteria?
    @scale_as_criteria
  end

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

  def to_select_option
    [ label, key ]
  end

  private

  def normalize text
    text.to_s.gsub(/\r\n?/, "\n").strip
  end
end
