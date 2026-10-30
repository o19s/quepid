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
end
