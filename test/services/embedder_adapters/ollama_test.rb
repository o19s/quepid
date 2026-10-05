# frozen_string_literal: true

require 'test_helper'

module EmbedderAdapters
  class OllamaTest < ActiveSupport::TestCase
    let(:embedder) do
      Embedder.new(name: 'Test', provider: 'ollama', service_url: 'http://ollama:11434',
                   model: 'qwen3-embedding:0.6b', instruction: 'Find films', timeout: 30)
    end

    test 'posts rendered inputs to /api/embed without a key' do
      embedder.api_key = 'ignored'
      stub = stub_request(:post, 'http://ollama:11434/api/embed')
        .with(body: { model: 'qwen3-embedding:0.6b', input: [ "Instruct: Find films\nQuery: star wars" ], truncate: true }) do |request|
          !request.headers.key?('Authorization')
        end
        .to_return(status: 200, headers: { 'Content-Type' => 'application/json' },
                   body: { model: 'qwen3-embedding:0.6b', embeddings: [ [ 0.1, 0.2, 0.3 ] ] }.to_json)

      assert_equal [ [ 0.1, 0.2, 0.3 ] ], embedder.embed([ 'star wars' ])
      assert_requested stub
    end

    test 'native truncation sends dimensions' do
      embedder.assign_attributes(truncation: 'native', dimensions: 2)
      stub = stub_request(:post, 'http://ollama:11434/api/embed')
        .with(body: hash_including(dimensions: 2))
        .to_return(status: 200, headers: { 'Content-Type' => 'application/json' },
                   body: { embeddings: [ [ 0.6, 0.8 ] ] }.to_json)

      embedder.embed([ 'star wars' ])

      assert_requested stub
    end

    test 'raises on a response without embeddings' do
      stub_request(:post, 'http://ollama:11434/api/embed')
        .to_return(status: 200, headers: { 'Content-Type' => 'application/json' }, body: { error: 'nope' }.to_json)

      assert_raises(EmbedderAdapters::Error) { embedder.embed([ 'star wars' ]) }
    end
  end
end
