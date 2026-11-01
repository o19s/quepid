# frozen_string_literal: true

require 'test_helper'

module DatasetIndex
  class IndexerTest < ActiveSupport::TestCase
    let(:user) { users(:random) }

    def endpoint engine, url, mapper: nil, **extra
      SearchEndpoint.new(owner: user, name: "My #{engine}", search_engine: engine, mapper_based_search_engine_id: mapper, api_method: 'POST',
                         endpoint_url: url, **extra)
    end

    def docs count
      Array.new(count) { |i| { 'id' => "d#{i}", 'title' => "Title #{i}", 'category' => [ 'a' ] } }
    end

    test 'knows the engines it can load' do
      assert(%w[es os solr vespa].all? { |engine| Indexer.supports?(engine) })
      %w[qdrant algolia vectara static searchapi].each { |engine| assert_not Indexer.supports?(engine), engine }
      assert_raises(Unsupported) { Indexer.new(endpoint('algolia', 'https://x/1/indexes/y/query'), 'y') }
    end

    test 'sends Elasticsearch documents through the bulk API, with their ids, in batches, and refreshes at the end' do
      es = endpoint('es', 'http://es.example.com:9200/movies/_search', basic_auth_credential: 'elastic:secret')
      bulk = stub_request(:post, 'http://es.example.com:9200/_bulk').with(basic_auth: %w[elastic secret], headers: { 'Content-Type' => 'application/x-ndjson' })
        .to_return { |request| { status: 200, body: { 'errors' => false, 'items' => Array.new(request.body.lines.size / 2) { { 'index' => { 'status' => 201 } } } }.to_json } }
      refresh = stub_request(:post, 'http://es.example.com:9200/movies/_refresh').to_return(status: 200, body: '{}')
      progress = []

      result = Indexer.new(es, 'movies').index(docs(1200)) { |count| progress << count }

      assert_equal [ 1200, 0, nil ], result.to_a
      assert_equal [ 500, 1000, 1200 ], progress
      assert_requested bulk, times: 3
      assert_requested refresh
      assert_requested :post, 'http://es.example.com:9200/_bulk', times: 1, body: ->(body) { 400 == body.lines.size && body.start_with?('{"index":{"_index":"movies","_id":"d1000"}}') }
    end

    test 'counts the documents Elasticsearch refuses, with the first reason' do
      es = endpoint('os', 'http://os.example.com/movies/_search')
      items = [ { 'index' => { 'status' => 201 } },
                { 'index' => { 'status' => 400, 'error' => { 'type' => 'strict_dynamic_mapping_exception', 'reason' => 'mapping set to strict, dynamic introduction of [rating]' } } },
                { 'index' => { 'status' => 400, 'error' => { 'type' => 'other', 'reason' => 'later' } } } ]
      stub_request(:post, 'http://os.example.com/_bulk').to_return(status: 200, body: { 'errors' => true, 'items' => items }.to_json)
      stub_request(:post, 'http://os.example.com/movies/_refresh').to_return(status: 200, body: '{}')

      result = Indexer.new(es, 'movies').index(docs(3))

      assert_equal [ 1, 2 ], [ result.indexed, result.failed ]
      assert_equal 'strict_dynamic_mapping_exception: mapping set to strict, dynamic introduction of [rating]', result.first_error
    end

    test 'stops with the endpoint answer when the bulk request itself is refused, or the endpoint cannot be reached' do
      es = endpoint('es', 'http://es.example.com:9200/movies/_search')
      stub_request(:post, 'http://es.example.com:9200/_bulk').to_return(status: 401, body: 'unauthorized')

      error = assert_raises(Error) { Indexer.new(es, 'movies').index(docs(2)) }

      assert_match(/answered 401/, error.message)

      stub_request(:post, 'http://es.example.com:9200/_bulk').to_timeout

      assert_match(/Could not reach/, assert_raises(Error) { Indexer.new(es, 'movies').index(docs(2)) }.message)
    end

    test 'sends Solr documents to the update handler of the collection, with a commit' do
      solr = endpoint('solr', 'http://solr.example.com:8983/solr/shop/select')
      update = stub_request(:post, 'http://solr.example.com:8983/solr/shop/update?commit=true').with(body: docs(3).to_json)
        .to_return(status: 200, body: '{"responseHeader":{"status":0}}')

      result = Indexer.new(solr, 'shop').index(docs(3))

      assert_requested update
      assert_equal [ 3, 0 ], [ result.indexed, result.failed ]
    end

    test 'stops with what Solr answered when it refuses' do
      solr = endpoint('solr', 'http://solr.example.com:8983/solr/shop/select')
      stub_request(:post, 'http://solr.example.com:8983/solr/shop/update?commit=true').to_return(status: 400, body: '{"error":{"msg":"unknown field nope"}}')

      assert_match(/answered 400.*unknown field nope/, assert_raises(Error) { Indexer.new(solr, 'shop').index(docs(1)) }.message)
    end

    test 'sends Vespa documents one at a time through the Document API, as the fields of a put' do
      vespa = endpoint('searchapi', 'https://a.vespa.cloud/search/', mapper: 'vespa')
      stubs = docs(2).to_h { |doc| [ doc['id'], stub_request(:post, "https://a.vespa.cloud/document/v1/quepid/quepid_haystack/docid/#{doc['id']}").with(body: { 'fields' => doc }.to_json).to_return(status: 200, body: '{}') ] }

      result = Indexer.new(vespa, 'quepid_haystack').index(docs(2))

      stubs.each_value { |stub| assert_requested stub }
      assert_equal [ 2, 0 ], [ result.indexed, result.failed ]
    end

    test 'counts the Vespa documents that were refused, and keeps going' do
      vespa = endpoint('searchapi', 'https://a.vespa.cloud/search/', mapper: 'vespa')
      stub_request(:post, 'https://a.vespa.cloud/document/v1/quepid/quepid_haystack/docid/d0').to_return(status: 400, body: '{"message":"No such field"}')
      stub_request(:post, 'https://a.vespa.cloud/document/v1/quepid/quepid_haystack/docid/d1').to_return(status: 200, body: '{}')

      result = Indexer.new(vespa, 'quepid_haystack').index(docs(2))

      assert_equal [ 1, 1 ], [ result.indexed, result.failed ]
      assert_match(/400: .*No such field/, result.first_error)
    end
  end
end
