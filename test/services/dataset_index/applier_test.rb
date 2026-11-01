# frozen_string_literal: true

require 'test_helper'

module DatasetIndex
  class ApplierTest < ActiveSupport::TestCase
    let(:user) { users(:random) }
    let(:haystack) { DatasetCatalog.find('haystack') }

    def endpoint engine, url, mapper: nil, **extra
      SearchEndpoint.new(owner: user, name: "My #{engine}", search_engine: engine, mapper_based_search_engine_id: mapper, api_method: 'POST', endpoint_url: url, **extra)
    end

    def definition_for(endpoint, **)
      DatasetIndex.build(endpoint: endpoint, dataset: haystack, **)
    end

    test 'creates an Elasticsearch index with a PUT of the definition' do
      es = endpoint('es', 'http://es.example.com:9200/movies/_search')
      definition = definition_for(es)
      stub = stub_request(:put, 'http://es.example.com:9200/movies').with(body: definition.body.to_json, headers: { 'Content-Type' => 'application/json' })
        .to_return(status: 200, body: '{"acknowledged":true,"index":"movies"}')

      DatasetIndex::Applier.new(es).apply(definition)

      assert_requested stub
    end

    test 'sends the endpoint credentials and custom headers' do
      es = endpoint('es', 'http://es.example.com:9200/movies/_search', basic_auth_credential: 'elastic:secret', custom_headers: { 'X-Team' => 'search' })
      stub = stub_request(:put, 'http://es.example.com:9200/movies').with(basic_auth: %w[elastic secret], headers: { 'X-Team' => 'search' })
        .to_return(status: 200, body: '{"acknowledged":true}')

      DatasetIndex::Applier.new(es).apply(definition_for(es))

      assert_requested stub
    end

    test 'says so when the index is already there, without touching it' do
      es = endpoint('es', 'http://es.example.com:9200/movies/_search')
      stub_request(:put, 'http://es.example.com:9200/movies')
        .to_return(status: 400, body: '{"error":{"type":"resource_already_exists_exception","reason":"index [movies] already exists"},"status":400}')

      error = assert_raises(DatasetIndex::AlreadyExists) { DatasetIndex::Applier.new(es).apply(definition_for(es)) }

      assert_match(/The index movies already exists on My es/, error.message)
    end

    test 'reports what the endpoint answered when it refuses' do
      es = endpoint('os', 'http://os.example.com/movies/_search')
      stub_request(:put, 'http://os.example.com/movies').to_return(status: 403, body: '{"error":"no permission to create indices"}')

      error = assert_raises(DatasetIndex::Error) { DatasetIndex::Applier.new(es).apply(definition_for(es)) }

      assert_match(/answered 403: .*no permission to create indices/, error.message)
    end

    test 'reports an endpoint it cannot reach' do
      es = endpoint('es', 'http://es.example.com:9200/movies/_search')
      stub_request(:put, 'http://es.example.com:9200/movies').to_timeout

      error = assert_raises(DatasetIndex::Error) { DatasetIndex::Applier.new(es).apply(definition_for(es)) }

      assert_match(%r{Could not reach http://es\.example\.com:9200/movies/_search}, error.message)
    end

    test 'adds the fields to a Solr collection through its schema API' do
      solr = endpoint('solr', 'http://solr.example.com:8983/solr/shop/select')
      definition = definition_for(solr)
      stub = stub_request(:post, 'http://solr.example.com:8983/solr/shop/schema').with(body: definition.body.to_json)
        .to_return(status: 200, body: '{"responseHeader":{"status":0}}')

      DatasetIndex::Applier.new(solr).apply(definition)

      assert_requested stub
    end

    test 'reports the errors Solr lists in a successful answer' do
      solr = endpoint('solr', 'http://solr.example.com:8983/solr/shop/select')
      stub_request(:post, 'http://solr.example.com:8983/solr/shop/schema')
        .to_return(status: 200, body: '{"responseHeader":{"status":400},"errors":[{"errorMessages":["Field \'title\' already exists."]}]}')

      error = assert_raises(DatasetIndex::Error) { DatasetIndex::Applier.new(solr).apply(definition_for(solr)) }

      assert_match(/already exists/, error.message)
    end

    test 'creates a Qdrant collection, then an index for each payload field' do
      qdrant = endpoint('searchapi', 'http://qdrant.example.com:6333/collections/shop/points/query', mapper: 'qdrant')
      definition = definition_for(qdrant, vector_size: 384)
      create = stub_request(:put, 'http://qdrant.example.com:6333/collections/shop').with(body: definition.body['collection'].to_json)
        .to_return(status: 200, body: '{"result":true,"status":"ok"}')
      indexes = stub_request(:put, 'http://qdrant.example.com:6333/collections/shop/index').to_return(status: 200, body: '{"result":{},"status":"ok"}')

      DatasetIndex::Applier.new(qdrant).apply(definition)

      assert_requested create
      assert_requested indexes, times: definition.body['payload_indexes'].size
    end

    test 'says so when the Qdrant collection is already there, and creates no indexes' do
      qdrant = endpoint('searchapi', 'http://qdrant.example.com:6333/collections/shop/points/query', mapper: 'qdrant')
      stub_request(:put, 'http://qdrant.example.com:6333/collections/shop').to_return(status: 409, body: '{"status":{"error":"already exists"}}')

      assert_raises(DatasetIndex::AlreadyExists) { DatasetIndex::Applier.new(qdrant).apply(definition_for(qdrant, vector_size: 384)) }
      assert_not_requested :put, 'http://qdrant.example.com:6333/collections/shop/index'
    end

    test 'refuses to apply a definition it has no way to create, and sends nothing' do
      vespa = endpoint('searchapi', 'https://a.vespa.cloud/search/', mapper: 'vespa')
      qdrant = endpoint('searchapi', 'http://qdrant.example.com:6333/collections/shop/points/query', mapper: 'qdrant')

      error = assert_raises(DatasetIndex::Unsupported) { DatasetIndex::Applier.new(vespa).apply(definition_for(vespa)) }
      assert_match(/application package/, error.message)
      assert_raises(DatasetIndex::Unsupported) { DatasetIndex::Applier.new(qdrant).apply(definition_for(qdrant)) }
      assert_not_requested :any, /.*/
    end
  end
end
