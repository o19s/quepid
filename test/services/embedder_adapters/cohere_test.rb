# frozen_string_literal: true

require 'test_helper'

module EmbedderAdapters
  class CohereTest < ActiveSupport::TestCase
    URL = 'https://api.cohere.com/v2/embed'

    let(:embedder) do
      Embedder.new(name: 'Test', provider: 'cohere', service_url: 'https://api.cohere.com',
                   model: 'embed-v4.0', api_key: 'co-test', timeout: 30)
    end

    test 'sends texts as search queries with a bearer key and reads embeddings.float' do
      stub = stub_request(:post, URL)
        .with(body:    { model: 'embed-v4.0', texts: [ 'star wars', 'alien' ], input_type: 'search_query',
                         embedding_types: [ 'float' ] },
              headers: { 'Authorization' => 'Bearer co-test' })
        .to_return(status: 200, headers: { 'Content-Type' => 'application/json' },
                   body: { id: 'x', embeddings: { float: [ [ 0.1, 0.2 ], [ 0.3, 0.4 ] ] }, texts: [ 'star wars', 'alien' ] }.to_json)

      assert_equal [ [ 0.1, 0.2 ], [ 0.3, 0.4 ] ], embedder.embed([ 'star wars', 'alien' ])
      assert_requested stub
    end

    test 'native truncation sends output_dimension' do
      embedder.assign_attributes(truncation: 'native', dimensions: 2)
      stub = stub_request(:post, URL)
        .with(body: hash_including(output_dimension: 2))
        .to_return(status: 200, headers: { 'Content-Type' => 'application/json' },
                   body: { embeddings: { float: [ [ 0.6, 0.8 ] ] } }.to_json)

      embedder.embed([ 'star wars' ])

      assert_requested stub
    end

    test 'reports Cohere\'s error message' do
      stub_request(:post, URL)
        .to_return(status: 400, headers: { 'Content-Type' => 'application/json' },
                   body: { message: 'invalid output_dimension 768 for model embed-v4.0' }.to_json)

      error = assert_raises(EmbedderAdapters::Error) { embedder.embed([ 'star wars' ]) }
      assert_equal 'Cohere API error: 400 - invalid output_dimension 768 for model embed-v4.0', error.message
    end

    test 'needs a key, and only offers sizes some Cohere model accepts' do
      assert_not Embedder.new(name: 'x', provider: 'cohere', service_url: 'https://api.cohere.com', model: 'embed-v4.0').valid?
      assert_not embedder.tap { |e| e.assign_attributes(truncation: 'native', dimensions: 300) }.valid?
      assert_predicate embedder.tap { |e| e.assign_attributes(truncation: 'native', dimensions: 768) }, :valid?
    end
  end
end
