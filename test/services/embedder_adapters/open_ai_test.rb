# frozen_string_literal: true

require 'test_helper'

module EmbedderAdapters
  class OpenAiTest < ActiveSupport::TestCase
    URL = 'https://api.openai.com/v1/embeddings'

    let(:embedder) do
      Embedder.new(name: 'Test', provider: 'openai', service_url: 'https://api.openai.com',
                   model: 'text-embedding-3-small', api_key: 'sk-test', timeout: 30)
    end

    def openai_response *vectors
      { data: vectors.each_with_index.map { |vector, index| { index: index, embedding: vector } } }.to_json
    end

    test 'posts the model and inputs with a bearer key and returns vectors in order' do
      stub = stub_request(:post, URL)
        .with(body:    { model: 'text-embedding-3-small', input: %w[a b] },
              headers: { 'Authorization' => 'Bearer sk-test' })
        # Out of order on purpose: the adapter must sort on index.
        .to_return(status: 200, headers: { 'Content-Type' => 'application/json' },
                   body: { data: [ { index: 1, embedding: [ 0.0, 1.0 ] }, { index: 0, embedding: [ 1.0, 0.0 ] } ] }.to_json)

      vectors = embedder.embed(%w[a b])

      assert_requested stub
      assert_equal [ [ 1.0, 0.0 ], [ 0.0, 1.0 ] ], vectors
    end

    test 'native truncation sends dimensions' do
      embedder.assign_attributes(truncation: 'native', dimensions: 2)
      stub = stub_request(:post, URL)
        .with(body: hash_including(dimensions: 2))
        .to_return(status: 200, headers: { 'Content-Type' => 'application/json' },
                   body: openai_response([ 0.6, 0.8 ]))

      assert_equal [ [ 0.6, 0.8 ] ], embedder.embed([ 'a' ])
      assert_requested stub
    end

    test 'client truncation keeps the leading components and re-normalizes' do
      embedder.assign_attributes(truncation: 'client', dimensions: 2)
      stub_request(:post, URL)
        .with { |request| !JSON.parse(request.body).key?('dimensions') }
        .to_return(status: 200, headers: { 'Content-Type' => 'application/json' },
                   body: openai_response([ 3.0, 4.0, 12.0 ]))

      assert_equal [ [ 0.6, 0.8 ] ], embedder.embed([ 'a' ])
    end

    test 'splits inputs into batches of the provider maximum' do
      provider = EmbedderProvider.find('openai')
      provider.max_batch_size = 2
      stub = stub_request(:post, URL)
        .to_return(
          { status: 200, headers: { 'Content-Type' => 'application/json' }, body: openai_response([ 1.0 ], [ 2.0 ]) },
          { status: 200, headers: { 'Content-Type' => 'application/json' }, body: openai_response([ 3.0 ]) }
        )

      embedder.define_singleton_method(:provider_definition) { provider }

      assert_equal [ [ 1.0 ], [ 2.0 ], [ 3.0 ] ], embedder.embed(%w[a b c])
      assert_requested stub, times: 2
    end

    test 'raises on an HTTP error with the provider message' do
      stub_request(:post, URL)
        .to_return(status: 401, headers: { 'Content-Type' => 'application/json' },
                   body: { error: { message: 'Incorrect API key provided' } }.to_json)

      error = assert_raises(EmbedderAdapters::Error) { embedder.embed([ 'a' ]) }
      assert_match(/401 - Incorrect API key provided/, error.message)
    end

    test 'raises when the vectors are not the configured size' do
      embedder.assign_attributes(truncation: 'native', dimensions: 3)
      stub_request(:post, URL)
        .to_return(status: 200, headers: { 'Content-Type' => 'application/json' }, body: openai_response([ 1.0, 0.0 ]))

      error = assert_raises(EmbedderAdapters::Error) { embedder.embed([ 'a' ]) }
      assert_equal 'expected 3 dimensions, got 2', error.message
    end

    test 'raises when fewer vectors come back than were asked for' do
      stub_request(:post, URL)
        .to_return(status: 200, headers: { 'Content-Type' => 'application/json' }, body: openai_response([ 1.0 ]))

      assert_raises(EmbedderAdapters::Error) { embedder.embed(%w[a b]) }
    end

    test 'keeps a path prefix on the service url' do
      embedder.assign_attributes(provider: 'openai_compatible', service_url: 'http://vllm:8000/proxy', api_key: nil)
      stub = stub_request(:post, 'http://vllm:8000/proxy/v1/embeddings')
        .to_return(status: 200, headers: { 'Content-Type' => 'application/json' }, body: openai_response([ 1.0 ]))

      embedder.embed([ 'a' ])

      assert_requested stub
    end
  end
end
