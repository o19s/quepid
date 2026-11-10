# frozen_string_literal: true

require 'test_helper'

class ConnectionProviderTest < ActiveSupport::TestCase
  test 'knows every provider the judge and embedder registries know' do
    (LlmProvider.all.map(&:key) + EmbedderProvider.all.map(&:key)).each do |key|
      assert ConnectionProvider.find(key), "no connection provider for #{key}"
    end
  end

  test 'a provider has the capabilities its registries give it' do
    assert_equal %w[chat embeddings], ConnectionProvider.find('openai').capabilities
    assert_equal %w[embeddings], ConnectionProvider.find('voyage').capabilities
    assert_equal %w[typed_judge], ConnectionProvider.find('typesafe_jev').capabilities
    assert_equal %w[search], ConnectionProvider.find('elasticsearch').capabilities
  end

  test 'every provider uses a valid scheme, with a header name when it sends the key in one' do
    ConnectionProvider.each do |provider|
      assert_includes Connection::AUTH_SCHEMES, provider.auth_scheme, provider.key
      assert_predicate provider.auth_header, :present?, "#{provider.key} needs a header name" if 'header' == provider.auth_scheme
    end
  end

  test 'old auth styles map to schemes' do
    assert_equal 'bearer', ConnectionProvider.find('openai').auth_scheme
    assert_equal 'none', ConnectionProvider.find('ollama').auth_scheme
    assert_equal(%w[header x-api-key], ConnectionProvider.find('anthropic').then { |s| [ s.auth_scheme, s.auth_header ] })
    assert_equal(%w[header api-key], ConnectionProvider.find('azure_openai').then { |s| [ s.auth_scheme, s.auth_header ] })
  end

  test 'a hosted embedder provider requires a key and a self-hosted one does not' do
    assert_predicate ConnectionProvider.find('voyage'), :requires_secret?
    assert_not ConnectionProvider.find('ollama').requires_secret?
    assert_not ConnectionProvider.find('openai_compatible').requires_secret?
  end

  test 'only Azure services take an API version' do
    assert_predicate ConnectionProvider.find('azure_openai'), :uses_api_version?
    assert_not ConnectionProvider.find('openai').uses_api_version?
  end

  test 'filters by capability' do
    keys = ConnectionProvider.with_capability(:embeddings).map(&:key)

    assert_includes keys, 'voyage'
    assert_not_includes keys, 'anthropic'
  end

  test 'presets are keyed by provider for the form' do
    preset = ConnectionProvider.presets.fetch('openai')

    assert_equal 'https://api.openai.com', preset[:base_url]
    assert_equal 'bearer', preset[:auth_scheme]
    assert_equal %w[chat embeddings], preset[:capabilities]
  end

  test 'groups the picker into AI, ML and LLM services and search engines' do
    groups = ConnectionProvider.grouped_select_options

    assert_equal [ 'AI, ML and LLM services', 'Search engines' ], groups.keys
    assert_includes groups['Search engines'].map(&:last), 'solr'
    assert_includes groups['AI, ML and LLM services'].map(&:last), 'openai'
    assert_equal ConnectionProvider.select_options.sort, groups.values.flatten(1).sort
  end
end
