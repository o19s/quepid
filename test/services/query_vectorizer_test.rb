# frozen_string_literal: true

require 'test_helper'

class QueryVectorizerTest < ActiveSupport::TestCase
  URL = 'https://api.openai.com/v1/embeddings'

  let(:embedder) { embedders(:openai_small) }
  let(:acase)    { cases(:shared_with_team) }

  def embeddings *vectors
    { status: 200, headers: { 'Content-Type' => 'application/json' },
      body: { data: vectors.each_with_index.map { |v, i| { index: i, embedding: v } } }.to_json }
  end

  def vector value
    Array.new(512, value)
  end

  test 'stores the vector and how it was made, keeping the user\'s own options' do
    query = acase.queries.create!(query_text: 'star wars', options: { 'boost' => 2 })
    stub_request(:post, URL).to_return(embeddings(vector(0.123456789)))

    result = QueryVectorizer.new(embedder).vectorize([ query ])

    assert_equal 1, result.vectorized
    opts = query.reload.options_hash
    assert_equal 2, opts['boost']
    assert_equal 512, opts['query_vec'].size
    assert_in_delta 0.1234568, opts['query_vec'].first, 1e-9
    meta = opts['query_vec_meta']
    assert_equal embedder.id, meta['embedder_id']
    assert_equal 'OpenAI small', meta['embedder_name']
    assert_equal 'openai', meta['provider']
    assert_equal 'text-embedding-3-small', meta['model']
    assert_equal 512, meta['dimensions']
    assert_equal 'native', meta['truncation']
    assert_equal embedder.fingerprint, meta['fingerprint']
    assert_equal embedder.input_digest('star wars'), meta['text_digest']
    assert_equal 'current', query.vector_status(embedder).status
  end

  test 'does not bump updated_at: a vector arriving is not the user editing the query' do
    query = acase.queries.create!(query_text: 'star wars')
    query.update_columns(updated_at: 2.days.ago)
    before = query.reload.updated_at
    stub_request(:post, URL).to_return(embeddings(vector(0.1)))

    QueryVectorizer.new(embedder).vectorize([ query ])

    assert_equal before, query.reload.updated_at
  end

  test 'a failed batch records the error and keeps the older vector' do
    query = acase.queries.create!(query_text: 'star wars', options: { 'query_vec' => [ 1.0 ], 'query_vec_meta' => { 'embedder_id' => -1 } })
    stub_request(:post, URL).to_return(status: 500, body: 'down')

    result = QueryVectorizer.new(embedder).vectorize([ query ])

    assert_equal 1, result.failed
    opts = query.reload.options_hash
    assert_equal [ 1.0 ], opts['query_vec']
    assert_match(/500/, opts['query_vec_error']['message'])
    assert_equal 'failed', query.vector_status(embedder).status
  end

  test 'a later success clears the error' do
    query = acase.queries.create!(query_text: 'star wars', options: { 'query_vec_error' => { 'message' => 'x' } })
    stub_request(:post, URL).to_return(embeddings(vector(0.1)))

    QueryVectorizer.new(embedder).vectorize([ query ])

    assert_not query.reload.options_hash.key?('query_vec_error')
  end

  test 'one failing batch does not stop the others' do
    provider = EmbedderProvider.find('openai')
    provider.max_batch_size = 1
    embedder.define_singleton_method(:provider_definition) { provider }
    first = acase.queries.create!(query_text: 'one')
    second = acase.queries.create!(query_text: 'two')
    stub_request(:post, URL).to_return({ status: 500, body: 'down' }, embeddings(vector(0.1)))

    done = []
    result = QueryVectorizer.new(embedder).vectorize([ first, second ]) { |count| done << count }

    assert_equal 1, result.failed
    assert_equal 1, result.vectorized
    assert_equal [ 1, 2 ], done
    assert_equal 'failed', first.reload.vector_status(embedder).status
    assert_equal 'current', second.reload.vector_status(embedder).status
  end
end
