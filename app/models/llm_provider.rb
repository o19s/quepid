# frozen_string_literal: true

# One LLM vendor an AI Judge can be pointed at.
#
# Not an ActiveRecord model: the set of providers is code, not data. A judge stores
# only the provider's `key` in its `judge_options[:llm_provider]`, and everything the
# app knows about that provider is looked up here -- see LlmProviders.
class LlmProvider
  attr_reader :key, :label, :default_service_url, :default_api_version, :default_model,
              :help_html, :notice_html, :read_only_fields, :adapter, :auth_style

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
  # rubocop:disable-next Metrics/ParameterLists -- keyword arguments, all of them required data
  def initialize(key:, label:, default_service_url:, default_model:, help_html:,
                 default_api_version: '', notice_html: nil, read_only_fields: [],
                 adapter: 'LlmJudgeAdapters::OpenAi', auth_style: :bearer)
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

    freeze
  end

  # True for a provider that is visible in the form but that Quepid cannot actually
  # judge with yet -- selecting it shows `notice_html` and saving is refused.
  def coming_soon?
    notice_html.present?
  end

  # The shape the AI Judge form's JavaScript expects for PROVIDER_PRESETS[key].
  def to_preset
    {
      llm_service_url: default_service_url,
      llm_api_version: default_api_version,
      llm_model:       default_model,
      help:            help_html,
      notice:          notice_html,
      read_only:       read_only_fields,
    }
  end

  def to_select_option
    [ label, key ]
  end
end
