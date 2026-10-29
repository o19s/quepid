# frozen_string_literal: true

require 'test_helper'

class ConnectionServiceTest < ActiveSupport::TestCase
  test 'knows every service the judge and embedder registries know' do
    (LlmProvider.all.map(&:key) + EmbedderProvider.all.map(&:key)).each do |key|
      assert ConnectionService.find(key), "no connection service for #{key}"
    end
  end

  test 'a service has the capabilities its registries give it' do
    assert_equal %w[chat embeddings], ConnectionService.find('openai').capabilities
    assert_equal %w[embeddings], ConnectionService.find('voyage').capabilities
    assert_equal %w[typed_judge], ConnectionService.find('typesafe_jev').capabilities
    assert_equal %w[search], ConnectionService.find('elasticsearch').capabilities
  end

  test 'every service uses a valid scheme, with a header name when it sends the key in one' do
    ConnectionService.each do |service|
      assert_includes Connection::AUTH_SCHEMES, service.auth_scheme, service.key
      assert_predicate service.auth_header, :present?, "#{service.key} needs a header name" if 'header' == service.auth_scheme
    end
  end

  test 'old auth styles map to schemes' do
    assert_equal 'bearer', ConnectionService.find('openai').auth_scheme
    assert_equal 'none', ConnectionService.find('ollama').auth_scheme
    assert_equal(%w[header x-api-key], ConnectionService.find('anthropic').then { |s| [ s.auth_scheme, s.auth_header ] })
    assert_equal(%w[header api-key], ConnectionService.find('azure_openai').then { |s| [ s.auth_scheme, s.auth_header ] })
  end

  test 'a hosted embedder service requires a key and a self-hosted one does not' do
    assert_predicate ConnectionService.find('voyage'), :requires_secret?
    assert_not ConnectionService.find('ollama').requires_secret?
    assert_not ConnectionService.find('openai_compatible').requires_secret?
  end

  test 'only Azure services take an API version' do
    assert_predicate ConnectionService.find('azure_openai'), :uses_api_version?
    assert_not ConnectionService.find('openai').uses_api_version?
  end

  test 'filters by capability' do
    keys = ConnectionService.with_capability(:embeddings).map(&:key)

    assert_includes keys, 'voyage'
    assert_not_includes keys, 'anthropic'
  end

  test 'presets are keyed by service for the form' do
    preset = ConnectionService.presets.fetch('openai')

    assert_equal 'https://api.openai.com', preset[:base_url]
    assert_equal 'bearer', preset[:auth_scheme]
    assert_equal %w[chat embeddings], preset[:capabilities]
  end
end
