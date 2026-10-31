# frozen_string_literal: true

require 'test_helper'

class DatasetIndexTest < ActiveSupport::TestCase
  let(:user) { users(:random) }
  let(:haystack) { DatasetCatalog.find('haystack') }

  def endpoint engine, url, mapper: nil
    SearchEndpoint.new(owner: user, name: "#{engine} endpoint", search_engine: engine, mapper_based_search_engine_id: mapper,
                       api_method: 'POST', endpoint_url: url)
  end

  test 'finds the engine of an endpoint, a mapper-based one by its own id' do
    assert_equal 'es', DatasetIndex.engine_id(endpoint('es', 'http://h:9200/m/_search'))
    assert_equal 'vespa', DatasetIndex.engine_id(endpoint('searchapi', 'https://a.vespa.cloud/search/', mapper: 'vespa'))
    assert_equal 'qdrant', DatasetIndex.engine_id(endpoint('searchapi', 'http://h:6333/collections/m/points/query', mapper: 'qdrant'))
  end

  test 'has a definition for Elasticsearch, OpenSearch, Solr, Qdrant, Vespa, Algolia and Vectara, and not for the rest' do
    assert_equal %w[es os solr qdrant vespa algolia vectara], DatasetIndex::BUILDERS.keys
    assert DatasetIndex.supported?(endpoint('os', 'http://h/m/_search'))
    assert_not DatasetIndex.supported?(endpoint('static', 'http://h/search'))
    assert_not DatasetIndex.supported?(endpoint('searchapi', 'https://search.ed.ac.uk'))
  end

  test 'refuses an engine it has no definition for' do
    assert_raises(DatasetIndex::Unsupported) { DatasetIndex.build(endpoint: endpoint('static', 'http://h/search'), dataset: haystack) }
    assert_raises(DatasetIndex::Unsupported) { DatasetIndex.index_name(endpoint('searchapi', 'https://x'), haystack) }
  end

  test 'names the index after the one the endpoint address names' do
    {
      [ 'es', 'http://h:9200/tmdb/_search' ]                                => 'tmdb',
      [ 'os', 'https://h/movies-2024/_search?size=10' ]                     => 'movies-2024',
      [ 'solr', 'http://h:8985/solr/statedecoded/select' ]                  => 'statedecoded',
      [ 'solr', 'http://h:8983/solr/ecommerce/query' ]                      => 'ecommerce',
      [ 'algolia', 'https://APP-dsn.algolia.net/1/indexes/products/query' ] => 'products',
    }.each do |(engine, url), expected|
      assert_equal expected, DatasetIndex.index_name(endpoint(engine, url), haystack), "#{engine} #{url}"
    end
    assert_equal 'catalog', DatasetIndex.index_name(endpoint('searchapi', 'http://h:6333/collections/catalog/points/query', mapper: 'qdrant'), haystack)
  end

  test 'names it after the dataset when the address names no usable index' do
    assert_equal 'quepid-haystack', DatasetIndex.index_name(endpoint('es', 'http://h:9200/_search'), haystack)
    assert_equal 'quepid-haystack', DatasetIndex.index_name(endpoint('es', 'http://h:9200/Has Capitals/_search'), haystack)
    assert_equal 'quepid-haystack', DatasetIndex.index_name(endpoint('es', 'http://h:9200/a,b/_search'), haystack)
    assert_equal 'quepid-haystack', DatasetIndex.index_name(endpoint('solr', 'http://h:8983/solr/select'), haystack)
    assert_equal 'quepid_haystack', DatasetIndex.index_name(endpoint('searchapi', 'https://a.vespa.cloud/search/', mapper: 'vespa'), haystack)
    assert_equal 'quepid-imdb', DatasetIndex.index_name(endpoint('es', 'not a url'), DatasetCatalog.find('imdb'))
  end

  test 'the Elasticsearch definition maps every canonical field, strictly' do
    definition = DatasetIndex.build(endpoint: endpoint('es', 'http://h:9200/movies/_search'), dataset: haystack)
    properties = definition.body['mappings']['properties']

    assert_equal 'es', definition.engine
    assert_equal 'movies', definition.index_name
    assert_equal :json, definition.format
    assert_equal :elasticsearch, definition.apply
    assert_equal 'strict', definition.body['mappings']['dynamic']
    assert_equal({ 'number_of_shards' => 1, 'number_of_replicas' => 0 }, definition.body['settings'])
    assert_equal CanonicalDatasetIndexSchema::FIELDS.map(&:name), properties.keys
    assert_equal({ 'type' => 'keyword' }, properties['id'])
    assert_equal({ 'type' => 'text', 'fields' => { 'keyword' => { 'type' => 'keyword', 'ignore_above' => 256 } } }, properties['title'])
    assert_equal({ 'type' => 'text' }, properties['description'])
    assert_equal({ 'type' => 'keyword', 'index' => false, 'doc_values' => false }, properties['thumb'])
    assert_equal({ 'type' => 'keyword', 'fields' => { 'text' => { 'type' => 'text' } } }, properties['brand'])
    assert_equal({ 'type' => 'float' }, properties['price'])
    assert_equal({ 'type' => 'float' }, properties['rating'])
    assert_equal({ 'type' => 'keyword' }, properties['category'])
    assert_equal JSON.pretty_generate(definition.body), definition.text
  end

  test 'the OpenSearch definition has the same mapping' do
    es = DatasetIndex.build(endpoint: endpoint('es', 'http://h/m/_search'), dataset: haystack)
    os = DatasetIndex.build(endpoint: endpoint('os', 'http://h/m/_search'), dataset: haystack)

    assert_equal %w[os OpenSearch], [ os.engine, os.label ]
    assert_equal es.body, os.body
    assert_equal :elasticsearch, os.apply
  end

  test 'the Solr definition adds the fields and the copies to an existing collection' do
    definition = DatasetIndex.build(endpoint: endpoint('solr', 'http://h:8983/solr/shop/select'), dataset: haystack)
    fields = definition.body['add-field'].index_by { |field| field['name'] }

    assert_equal :solr, definition.apply
    assert_equal 'shop', definition.index_name
    assert_equal %w[title title_exact description thumb brand brand_text price rating category], fields.keys
    assert_not_includes fields.keys, 'id', 'Solr collections have an id already'
    assert_equal 'text_general', fields['title']['type']
    assert_not fields['thumb']['indexed']
    assert fields['category']['multiValued']
    assert_equal 'pfloat', fields['price']['type']
    assert_equal [ { 'source' => 'title', 'dest' => 'title_exact' }, { 'source' => 'brand', 'dest' => 'brand_text' } ], definition.body['add-copy-field']
  end

  test 'the Qdrant definition has a collection and payload indexes, and can be applied only when the vector size is known' do
    qdrant = endpoint('searchapi', 'http://h:6333/collections/shop/points/query', mapper: 'qdrant')
    without = DatasetIndex.build(endpoint: qdrant, dataset: haystack)
    with = DatasetIndex.build(endpoint: qdrant, dataset: haystack, vector_size: 384)

    assert_nil without.apply
    assert_not without.applicable?
    assert_match(/how long the vectors are/, without.note)
    assert_equal :qdrant, with.apply
    assert_equal({ 'dense' => { 'size' => 384, 'distance' => 'Cosine' } }, with.body['collection']['vectors'])
    assert_equal %w[id title description brand category price rating], with.body['payload_indexes'].pluck('field_name')
    assert_equal 'text', with.body['payload_indexes'].find { |index| 'title' == index['field_name'] }['field_schema']
    assert_equal 'float', with.body['payload_indexes'].find { |index| 'rating' == index['field_name'] }['field_schema']
  end

  test 'the Vespa definition is a schema file that is only shown' do
    definition = DatasetIndex.build(endpoint: endpoint('searchapi', 'https://a.vespa.cloud/search/', mapper: 'vespa'), dataset: haystack)

    assert_equal :text, definition.format
    assert_nil definition.apply
    assert_match(/\Aschema quepid_haystack \{/, definition.text)
    assert_match(/field category type array<string>/, definition.text)
    assert_match(/field price type float/, definition.text)
    assert_equal definition.body, definition.text
    assert_match(%r{schemas/quepid_haystack\.sd}, definition.note)
  end

  test 'the Algolia and Vectara definitions are shown, not applied' do
    algolia = DatasetIndex.build(endpoint: endpoint('algolia', 'https://APP-dsn.algolia.net/1/indexes/shop/query'), dataset: haystack)
    vectara = DatasetIndex.build(endpoint: endpoint('vectara', 'https://api.vectara.io/v2/corpora/x/query'), dataset: haystack)

    assert_equal [ 'shop', nil ], [ algolia.index_name, algolia.apply ]
    assert_equal %w[title description brand category], algolia.body['searchableAttributes']
    assert_equal [ 'desc(rating)' ], algolia.body['customRanking']
    assert_equal 'quepid-haystack', vectara.index_name
    assert_nil vectara.apply
    assert_equal %w[brand category price rating], vectara.body['filter_attributes'].pluck('name')
  end

  test 'every definition has text to show' do
    DatasetIndex::BUILDERS.each_key do |engine|
      mapper = %w[vespa qdrant].include?(engine) ? engine : nil
      url = { 'es' => 'http://h/m/_search', 'os' => 'http://h/m/_search', 'solr' => 'http://h/solr/m/select' }.fetch(engine, 'https://h/x')
      definition = DatasetIndex.build(endpoint: endpoint(mapper ? 'searchapi' : engine, url, mapper: mapper), dataset: haystack)

      assert_predicate definition.text, :present?, engine
    end
  end

  test 'an edited definition has the new name and body, and keeps the rest' do
    original = DatasetIndex.build(endpoint: endpoint('es', 'http://h:9200/movies/_search'), dataset: haystack)
    edited = original.edited(index_name: '  my-index ', text: '{"settings": {"number_of_shards": 3}}')

    assert_equal 'my-index', edited.index_name
    assert_equal({ 'settings' => { 'number_of_shards' => 3 } }, edited.body)
    assert_equal [ original.engine, original.apply, original.label ], [ edited.engine, edited.apply, edited.label ]
    assert_equal 'movies', original.index_name, 'the proposed one is not changed'
  end

  test 'an edited definition is refused when it cannot be sent safely' do
    definition = DatasetIndex.build(endpoint: endpoint('es', 'http://h:9200/movies/_search'), dataset: haystack)
    {
      [ '', '{}' ]                                                 => /Give the index a name/,
      [ '../_all', '{}' ]                                          => /is not a name Elasticsearch accepts/,
      [ 'a b', '{}' ]                                              => /is not a name/,
      [ 'ok', '{oops' ]                                            => /not valid JSON/,
      [ 'ok', '[]' ]                                               => /must be a JSON object/,
      [ 'ok', '"text"' ]                                           => /must be a JSON object/,
      [ 'ok', %({"a": "#{'x' * DatasetIndex::MAX_TEXT_LENGTH}"}) ] => /too long/,
    }.each do |(name, text), message|
      error = assert_raises(DatasetIndex::InvalidDefinition) { definition.edited(index_name: name, text: text) }

      assert_match message, error.message
    end
  end

  test 'a definition that is not JSON cannot be edited' do
    vespa = DatasetIndex.build(endpoint: endpoint('searchapi', 'https://a.vespa.cloud/search/', mapper: 'vespa'), dataset: haystack)

    assert_raises(DatasetIndex::InvalidDefinition) { vespa.edited(index_name: 'quepid_x', text: '{}') }
  end

  test 'Solr takes only commands that add, Qdrant a collection and payload indexes' do
    solr = DatasetIndex.build(endpoint: endpoint('solr', 'http://h:8983/solr/shop/select'), dataset: haystack)

    assert solr.edited(index_name: 'shop', text: '{"add-field": [], "add-field-type": {}}')
    error = assert_raises(DatasetIndex::InvalidDefinition) { solr.edited(index_name: 'shop', text: '{"add-field": [], "delete-field": {}, "replace-field": {}}') }
    assert_match(/not delete-field, replace-field/, error.message)

    qdrant = DatasetIndex.build(endpoint: endpoint('searchapi', 'http://h:6333/collections/shop/points/query', mapper: 'qdrant'), dataset: haystack, vector_size: 8)
    good = '{"collection": {"vectors": {"dense": {"size": 8, "distance": "Cosine"}}}, "payload_indexes": [{"field_name": "id", "field_schema": "keyword"}]}'

    assert qdrant.edited(index_name: 'shop', text: good)
    [ '{}', '{"collection": {}, "payload_indexes": []}', '{"collection": {"vectors": {"a": 1}}}',
      '{"collection": {"vectors": {"a": 1}}, "payload_indexes": [1]}' ].each do |bad|
      assert_raises(DatasetIndex::InvalidDefinition, bad) { qdrant.edited(index_name: 'shop', text: bad) }
    end
  end
end
