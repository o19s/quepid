# frozen_string_literal: true

require 'test_helper'

module EmbedderAdapters
  class VoyageTest < ActiveSupport::TestCase
    test 'marks inputs as queries and names the size output_dimension' do
      embedder = Embedder.new(name: 'Test', provider: 'voyage', service_url: 'https://api.voyageai.com',
                              model: 'voyage-3.5', api_key: 'pa-test', truncation: 'native', dimensions: 256,
                              timeout: 30)
      stub = stub_request(:post, 'https://api.voyageai.com/v1/embeddings')
        .with(body:    { model: 'voyage-3.5', input: [ 'star wars' ], input_type: 'query', output_dimension: 256 },
              headers: { 'Authorization' => 'Bearer pa-test' })
        .to_return(status: 200, headers: { 'Content-Type' => 'application/json' },
                   body: { data: [ { index: 0, embedding: Array.new(256, 0.1) } ] }.to_json)

      vectors = embedder.embed([ 'star wars' ])

      assert_requested stub
      assert_equal 256, vectors.first.size
    end
  end
end
