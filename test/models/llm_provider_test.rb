# frozen_string_literal: true

require 'test_helper'

class LlmProviderTest < ActiveSupport::TestCase
  # The values the AI Judge form hardcoded before the registry existed. This table is
  # the guard for that extraction: it must keep passing unchanged, so a provider's
  # defaults can only move deliberately.
  EXPECTED = {
    'openai'                      => [ 'OpenAI', 'https://api.openai.com', '', 'gpt-4o' ],
    'azure_openai'                => [ 'Azure OpenAI', 'https://RESOURCE.openai.azure.com', '', 'gpt-4.1' ],
    'azure_ai_foundry'            => [ 'Azure AI Foundry', 'https://RESOURCE.services.ai.azure.com',
                                       '2025-01-01-preview', 'gpt-4o' ],
    'azure_ai_foundry_serverless' => [ 'Azure AI Foundry (Serverless)',
                                       'https://MODEL-NAME.REGION.models.ai.azure.com', '', '' ],
    'azure_ai_foundry_anthropic'  => [ 'Azure AI Foundry (Anthropic)',
                                       'https://RESOURCE.services.ai.azure.com/anthropic', '',
                                       'claude-3-5-haiku-20241022' ],
    'anthropic'                   => [ 'Anthropic', 'https://api.anthropic.com', '',
                                       'claude-sonnet-4-5-20250514' ],
    'google_gemini'               => [ 'Google Gemini',
                                       'https://generativelanguage.googleapis.com/v1beta/openai', '',
                                       'gemini-2.0-flash' ],
    'ollama'                      => [ 'Ollama', :from_config, '', 'qwen3:0.6b' ],
    'typesafe_jev'                => [ 'TypeSafe Jev', 'https://api.typesafe.ai', '', 'jev-latest' ],
  }.freeze

  test 'registers every provider the form offered, in the same order' do
    assert_equal EXPECTED.keys, LlmProvider.all.map(&:key)
  end

  test 'each provider keeps its label and form defaults' do
    EXPECTED.each do |key, (label, url, api_version, model)|
      provider = LlmProvider.find(key)
      url = Rails.configuration.ollama_service_url if :from_config == url

      assert_equal label, provider.label, "#{key} label"
      assert_equal url, provider.default_service_url, "#{key} service url"
      assert_equal api_version, provider.default_api_version, "#{key} api version"
      assert_equal model, provider.default_model, "#{key} model"
    end
  end

  test 'every provider has help text naming itself' do
    LlmProvider.each do |provider|
      assert_includes provider.help_html, "<strong>#{provider.label}</strong>", "#{provider.key} help"
      assert_includes provider.help_html, '<b>API Version:</b>', "#{provider.key} help"
    end
  end

  test 'ollama help follows the configured service url' do
    original = Rails.configuration.ollama_service_url
    Rails.configuration.ollama_service_url = 'http://ollama.example:31434'

    assert_equal 'http://ollama.example:31434', LlmProvider.find('ollama').default_service_url
    assert_includes LlmProvider.find('ollama').help_html, '<code>http://ollama.example:31434</code>'
  ensure
    Rails.configuration.ollama_service_url = original
  end

  test 'select options are [label, key] pairs for the dropdown' do
    assert_equal [ [ 'OpenAI', 'openai' ], [ 'Azure OpenAI', 'azure_openai' ] ],
                 LlmProvider.select_options.first(2)
  end

  test 'lookup by key accepts strings and symbols, and misses return nil' do
    assert_equal 'openai', LlmProvider.find('openai').key
    assert_equal 'openai', LlmProvider.find(:openai).key
    assert_nil LlmProvider.find('no_such_provider')
  end

  test 'presets carry the keys the form javascript reads' do
    preset = LlmProvider.presets.fetch('openai')

    assert_equal [ :llm_service_url, :llm_api_version, :llm_model, :help, :read_only,
                   :system_prompt, :prompt_label, :prompt_hint, :scale_as_criteria, :needs_book ],
                 preset.keys
    assert_equal 'https://api.openai.com', preset[:llm_service_url]
  end

  test 'presets serialize to JSON the form can inline' do
    json = LlmProvider.presets.to_json
    parsed = JSON.parse(json)

    assert_equal LlmProvider.all.map(&:key).sort, parsed.keys.sort
    assert_equal 'gpt-4o', parsed.dig('openai', 'llm_model')
    assert_includes parsed.dig('openai', 'help'), '<strong>OpenAI</strong>'
  end

  test 'a caller changing a provider it looked up cannot change the registry' do
    LlmProvider.find('openai').default_model = 'changed'

    assert_equal 'gpt-4o', LlmProvider.find('openai').default_model
  end

  test 'each provider names the dialect it speaks and how its key is sent' do
    anthropic_keys = %w[anthropic azure_ai_foundry_anthropic]
    api_key_keys = %w[azure_openai azure_ai_foundry azure_ai_foundry_serverless azure_ai_foundry_anthropic]

    LlmProvider.each do |provider|
      expected_adapter = if anthropic_keys.include?(provider.key)
                           'LlmJudgeAdapters::Anthropic'
                         elsif 'typesafe_jev' == provider.key
                           'LlmJudgeAdapters::Jev'
                         else
                           'LlmJudgeAdapters::OpenAi'
                         end

      assert_equal expected_adapter, provider.adapter, "#{provider.key} adapter"
    end

    assert_equal :x_api_key, LlmProvider.find('anthropic').auth_style
    assert_equal :x_api_key, LlmProvider.find('azure_ai_foundry_anthropic').auth_style
    api_key_keys.excluding('azure_ai_foundry_anthropic').each do |key|
      assert_equal :api_key, LlmProvider.find(key).auth_style, "#{key} auth style"
    end
    assert_equal :bearer, LlmProvider.find('openai').auth_style
    assert_equal :bearer, LlmProvider.find('ollama').auth_style
  end

  test 'every registered adapter resolves to a class that can build a request' do
    LlmProvider.each do |provider|
      next if provider.adapter.nil?

      adapter = provider.adapter.constantize

      assert_operator adapter, :<, LlmJudgeAdapters::Base, "#{provider.key} adapter"
    end
  end

  test 'a chat provider ships the prompt that spells out the scale and the answer format' do
    prompt = LlmProvider.find('openai').default_system_prompt

    assert_equal LlmProvider::CHAT_SYSTEM_PROMPT, prompt
    assert_includes prompt, 'scale of 0 to 3'
    assert_includes prompt, 'JSON format'
    assert_equal prompt, AiJudgesController::DEFAULT_SYSTEM_PROMPT, 'the old constant still resolves'
  end

  test 'jev ships a prompt that says what to weigh and nothing the request already carries' do
    prompt = LlmProvider.find('typesafe_jev').default_system_prompt

    assert_equal LlmProvider::JEV_SYSTEM_PROMPT, prompt
    assert_no_match(/0 to 3/, prompt, 'the scale comes from the book, not the prompt')
    assert_no_match(/JSON/, prompt, 'a typed model cannot be instructed into another shape')
    assert_match(/satisfies the user's query/, prompt)
  end

  test 'jev offers its confidence floor as a field, not as JSON to hand-edit' do
    field = LlmProvider.find('typesafe_jev').option_fields['jev_min_confidence']

    assert_equal 'Minimum confidence', field[:label]
    assert_equal :number, field[:type], 'a spinner, not a text box to type a float into'
    assert_equal [ 0, 1 ], [ field[:min], field[:max] ]
    assert_in_delta(0.1, field[:step])
    assert_includes field[:hint], 'unrateable'
    assert_empty LlmProvider.find('openai').option_fields
    assert_no_match(/JSON tab/, LlmProvider.find('typesafe_jev').help_html)
  end

  test 'the field is called what it actually is for each provider' do
    assert_equal 'System prompt', LlmProvider.find('openai').prompt_label
    assert_nil LlmProvider.find('openai').prompt_hint

    jev = LlmProvider.find('typesafe_jev')

    assert_equal 'Judging instructions', jev.prompt_label
    assert_includes jev.prompt_hint, 'no system prompt'
    assert_includes jev.prompt_hint, 'instructions on the question'
  end

  test 'the stock prompts are what the form treats as untouched' do
    assert_includes LlmProvider.stock_system_prompts, LlmProvider::CHAT_SYSTEM_PROMPT
    assert_includes LlmProvider.stock_system_prompts, LlmProvider::JEV_SYSTEM_PROMPT
    assert_equal LlmProvider.stock_system_prompts, LlmProvider.stock_system_prompts.uniq
    assert_equal LlmProvider.stock_system_prompts, JSON.parse(LlmProvider.stock_system_prompts.to_json)
  end

  test 'jev fixes the endpoint and model it dictates, and says where a key comes from' do
    jev = LlmProvider.find('typesafe_jev')

    assert_equal %w[llm_service_url llm_model llm_api_version], jev.read_only_fields
    assert_equal jev.read_only_fields, jev.to_preset[:read_only]
    assert_includes jev.help_html, 'https://console.typesafe.ai/keys'
  end
end
