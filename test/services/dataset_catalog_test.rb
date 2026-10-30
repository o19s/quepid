# frozen_string_literal: true

require 'test_helper'

class DatasetCatalogTest < ActiveSupport::TestCase
  let(:user) { users(:random) }
  let(:haystack) { DatasetCatalog.find('haystack') }

  def endpoint url
    SearchEndpoint.new(owner: user, name: 'E', search_engine: :solr, api_method: 'JSONP', endpoint_url: url)
  end

  test 'Haystack is preindexed in the Chorus Solr its export names, however the address is written' do
    chorus = 'http://chorus.dev.o19s.com:8983/solr/ecommerce/select'

    assert haystack.preindexed_in?(endpoint(chorus))
    assert haystack.preindexed_in?(endpoint("  #{chorus}/ "))
  end

  test 'it is not preindexed anywhere else, and a dataset with no preindexed location is not preindexed anywhere' do
    assert_not haystack.preindexed_in?(endpoint('http://chorus.dev.o19s.com:8983/solr/other/select'))
    assert_not haystack.preindexed_in?(endpoint('http://elsewhere.example.com/solr/ecommerce/select'))
    assert_not haystack.preindexed_in?(endpoint(''))
    assert_not DatasetCatalog.find('imdb').preindexed_in?(endpoint('http://chorus.dev.o19s.com:8983/solr/ecommerce/select'))
  end

  test 'WANDS can be loaded, with its three labels as a scale of their own' do
    wands = DatasetCatalog.find('wands')

    assert wands.available
    assert_equal WandsDataset, wands.loader
    assert_equal DatasetDocumentMappers::Wands, wands.mapper
    assert_equal :wands, wands.documents_from
    assert_equal({ '0' => 'Irrelevant', '1' => 'Partial', '2' => 'Exact' }, wands.scale_labels)
    assert_equal [ 480, 42_994 ], [ wands.query_total, wands.document_total ]
    assert_predicate wands, :sampleable?
    assert_not wands.preindexed_in?(SearchEndpoint.new(endpoint_url: 'http://anywhere/x'))
  end

  test 'what the catalog says about WANDS matches the files' do
    wands = DatasetCatalog.find('wands')

    assert_equal '480 queries', wands.queries
    assert_includes wands.documents, '42,994 products'
    assert_includes wands.judgements, '233,448 labels on 231,873'
    assert_includes wands.description, 'MIT licence'
  end
end
