# frozen_string_literal: true

require 'test_helper'

class LlmProvidersTest < ActiveSupport::TestCase
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
    'typesafe_jev'                => [ 'TypeSafe Jev (coming soon)', 'https://api.typesafe.ai', '',
                                       'jev-latest' ],
  }.freeze

  test 'registers every provider the form offered, in the same order' do
    assert_equal EXPECTED.keys, LlmProviders.keys
  end

  test 'each provider keeps its label and form defaults' do
    EXPECTED.each do |key, (label, url, api_version, model)|
      provider = LlmProviders[key]
      url = Rails.configuration.ollama_service_url if :from_config == url

      assert_equal label, provider.label, "#{key} label"
      assert_equal url, provider.default_service_url, "#{key} service url"
      assert_equal api_version, provider.default_api_version, "#{key} api version"
      assert_equal model, provider.default_model, "#{key} model"
    end
  end

  test 'every provider has help text naming itself' do
    LlmProviders.each do |provider|
      assert_includes provider.help_html, "<strong>#{provider.label}</strong>", "#{provider.key} help"
      assert_includes provider.help_html, '<b>API Version:</b>', "#{provider.key} help"
    end
  end

  test 'ollama help follows the configured service url' do
    original = Rails.configuration.ollama_service_url
    Rails.configuration.ollama_service_url = 'http://ollama.example:31434'

    assert_equal 'http://ollama.example:31434', LlmProviders['ollama'].default_service_url
    assert_includes LlmProviders['ollama'].help_html, '<code>http://ollama.example:31434</code>'
  ensure
    Rails.configuration.ollama_service_url = original
  end

  test 'select options are [label, key] pairs for the dropdown' do
    assert_equal [ [ 'OpenAI', 'openai' ], [ 'Azure OpenAI', 'azure_openai' ] ],
                 LlmProviders.select_options.first(2)
  end

  test 'lookup by key accepts strings and symbols, and misses return nil' do
    assert_equal 'openai', LlmProviders['openai'].key
    assert_equal 'openai', LlmProviders[:openai].key
    assert_nil LlmProviders['no_such_provider']
  end

  test 'presets carry the keys the form javascript reads' do
    preset = LlmProviders.presets.fetch('openai')

    assert_equal [ :llm_service_url, :llm_api_version, :llm_model, :help, :notice, :read_only ],
                 preset.keys
    assert_equal 'https://api.openai.com', preset[:llm_service_url]
  end

  test 'presets_json round trips and is safe to inline in a script tag' do
    json = LlmProviders.presets_json
    parsed = JSON.parse(json)

    assert_equal LlmProviders.keys.sort, parsed.keys.sort
    assert_equal 'gpt-4o', parsed.dig('openai', 'llm_model')
    assert_includes parsed.dig('openai', 'help'), '<strong>OpenAI</strong>'
    # ActiveSupport \u-escapes HTML entities, so no raw tag can terminate the <script>
    assert_not_includes json, '<'
    assert_not_includes json, '>'
  end

  test 'providers are frozen so a caller cannot mutate the registry' do
    assert_predicate LlmProviders['openai'], :frozen?
  end

  test 'each provider names the dialect it speaks and how its key is sent' do
    anthropic_keys = %w[anthropic azure_ai_foundry_anthropic]
    api_key_keys = %w[azure_openai azure_ai_foundry azure_ai_foundry_serverless azure_ai_foundry_anthropic]

    LlmProviders.each do |provider|
      expected_adapter = if anthropic_keys.include?(provider.key)
                           'LlmJudgeAdapters::Anthropic'
                         else
                           'LlmJudgeAdapters::OpenAi'
                         end

      if 'typesafe_jev' == provider.key
        assert_nil provider.adapter, 'a provider we cannot judge with has no adapter'
      else
        assert_equal expected_adapter, provider.adapter, "#{provider.key} adapter"
      end
    end

    assert_equal :x_api_key, LlmProviders['anthropic'].auth_style
    assert_equal :x_api_key, LlmProviders['azure_ai_foundry_anthropic'].auth_style
    api_key_keys.excluding('azure_ai_foundry_anthropic').each do |key|
      assert_equal :api_key, LlmProviders[key].auth_style, "#{key} auth style"
    end
    assert_equal :bearer, LlmProviders['openai'].auth_style
    assert_equal :bearer, LlmProviders['ollama'].auth_style
  end

  test 'every registered adapter resolves to a class that can build a request' do
    LlmProviders.each do |provider|
      next if provider.adapter.nil?

      adapter = provider.adapter.constantize

      assert_operator adapter, :<, LlmJudgeAdapters::Base, "#{provider.key} adapter"
    end
  end

  test 'only the placeholder providers are coming soon' do
    assert_equal [ 'typesafe_jev' ], LlmProviders.coming_soon.map(&:key)
    assert_not_predicate LlmProviders['openai'], :coming_soon?
    assert_empty LlmProviders['openai'].read_only_fields
    assert_nil LlmProviders['openai'].to_preset[:notice]
  end

  test 'jev tells the team what it needs and links to where the key comes from' do
    jev = LlmProviders['typesafe_jev']

    assert_predicate jev, :coming_soon?
    assert_includes jev.notice_html, 'Coming soon'
    assert_includes jev.notice_html, 'https://console.typesafe.ai/keys'
    assert_includes jev.notice_html, 'LLM Key'
    assert_equal %w[llm_service_url llm_model llm_api_version], jev.read_only_fields
    assert_equal jev.read_only_fields, jev.to_preset[:read_only]
  end
end
