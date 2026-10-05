# frozen_string_literal: true

require 'test_helper'

class EmbedderProviderTest < ActiveSupport::TestCase
  test 'every provider names an adapter that exists' do
    EmbedderProvider.select_options.map(&:last).each do |key|
      assert_operator EmbedderProvider.find(key).adapter_class, :<, EmbedderAdapters::Base, "#{key} has no usable adapter"
    end
  end

  test 'find looks up by key, string or symbol' do
    assert_equal 'Voyage AI', EmbedderProvider.find(:voyage).label
    assert_nil EmbedderProvider.find('nope')
  end

  test 'ollama takes its url from config' do
    assert_equal Rails.configuration.ollama_service_url, EmbedderProvider.find('ollama').default_service_url
  end

  test 'presets carry what the form needs for every provider' do
    presets = EmbedderProvider.presets

    assert_equal EmbedderProvider.keys, presets.keys
    assert_equal [ 256, 512, 1024, 2048 ], presets['voyage'][:allowed_dimensions]
    assert presets['ollama'][:supports_instructions]
    assert_not presets['openai'][:supports_instructions]
    assert_not presets['ollama'][:uses_key]
  end
end
