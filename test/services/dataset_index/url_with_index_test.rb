# frozen_string_literal: true

require 'test_helper'

class DatasetIndexUrlWithIndexTest < ActiveSupport::TestCase
  test 'Elasticsearch swaps the index in the address, or adds one, and keeps the rest' do
    builder = DatasetIndex::Elasticsearch

    assert_equal 'http://es:9200/wands/_search', builder.url_with_index('http://es:9200/haystack/_search', 'wands')
    assert_equal 'http://es:9200/wands/_search', builder.url_with_index('http://es:9200/_search', 'wands')
    assert_equal 'https://es.example.com/wands/_search?size=5', builder.url_with_index('https://es.example.com/haystack/_search?size=5', 'wands')
  end

  test 'Solr swaps the collection in the address, or adds one' do
    builder = DatasetIndex::Solr

    assert_equal 'http://solr:8983/solr/wands/select', builder.url_with_index('http://solr:8983/solr/shop/select', 'wands')
    assert_equal 'http://solr:8983/solr/wands/query', builder.url_with_index('http://solr:8983/solr/query', 'wands')
    assert_equal 'http://solr:8983/solr/wands/select', builder.url_with_index('http://solr:8983/solr/select', 'wands')
  end

  test 'Qdrant swaps the collection in the address, and has none to swap when it names none' do
    builder = DatasetIndex::Qdrant

    assert_equal 'http://qd:6333/collections/wands/points/query', builder.url_with_index('http://qd:6333/collections/shop/points/query', 'wands')
    assert_equal 'https://qd.example.com/collections/wands/points/search?wait=true',
                 builder.url_with_index('https://qd.example.com/collections/shop/points/search?wait=true', 'wands')
    assert_nil builder.url_with_index('http://qd:6333/points/query', 'wands')
  end

  test 'a copy of an endpoint keeps its connection details and names the new index' do
    owner = users(:random)
    endpoint = SearchEndpoint.create!(owner: users(:doug), name: 'Shop', search_engine: :solr, api_method: 'GET', basic_auth_credential: 'u:p',
                                      endpoint_url: 'http://solr:8983/solr/shop/select', custom_headers: { 'X-Key' => '1' }, archived: true)

    copy = DatasetIndex.endpoint_for_index(endpoint, 'wands', owner)

    assert_predicate copy, :new_record?
    assert_equal [ owner, 'http://solr:8983/solr/wands/select', 'Shop (wands)', false ], [ copy.owner, copy.endpoint_url, copy.name, copy.archived ]
    assert_equal [ 'u:p', { 'X-Key' => '1' }, 'solr', 'GET' ], [ copy.basic_auth_credential, copy.custom_headers, copy.search_engine, copy.api_method ]
    assert_equal 'http://solr:8983/solr/shop/select', endpoint.endpoint_url
  end

  test 'there is no copy for an engine whose address cannot name an index' do
    vespa = SearchEndpoint.create!(owner: users(:random), name: 'V', search_engine: :searchapi, mapper_based_search_engine_id: 'vespa',
                                   api_method: 'POST', endpoint_url: 'https://a.vespa.cloud/search/')

    assert_nil DatasetIndex.endpoint_for_index(vespa, 'wands', users(:random))
  end
end
