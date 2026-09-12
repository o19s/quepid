# frozen_string_literal: true

require 'test_helper'

class MapperBasedSearchEngineTest < ActiveSupport::TestCase
  describe '.all' do
    it 'returns MapperBasedSearchEngine instances' do
      assert(MapperBasedSearchEngine.all.all?(MapperBasedSearchEngine))
    end

    it 'includes the Vespa definition with mapper code loaded from disk' do
      vespa = MapperBasedSearchEngine.all.find { |engine| 'vespa' == engine.id }

      assert vespa
      assert_equal 'Vespa', vespa.name
      assert_equal 'searchapi', vespa.search_engine
      assert_equal File.read(Rails.root.join('db/mapper_based_search_engines/vespa.js')), vespa.mapper_code
    end

    it 'lets Vespa auto-switch between GET and POST, wrapping bare text under yql' do
      vespa = MapperBasedSearchEngine.find('vespa')

      assert_equal 'AUTO', vespa.api_method
      assert_equal 'yql', vespa.bare_query_param
    end

    it 'includes the Qdrant definition with mapper code loaded from disk' do
      qdrant = MapperBasedSearchEngine.all.find { |engine| 'qdrant' == engine.id }

      assert qdrant
      assert_equal 'Qdrant', qdrant.name
      assert_equal 'searchapi', qdrant.search_engine
      assert_equal File.read(Rails.root.join('db/mapper_based_search_engines/qdrant.js')), qdrant.mapper_code
    end

    it 'gives every definition a unique id and a mapper file that exists' do
      engines = MapperBasedSearchEngine.all

      assert_equal engines.map(&:id).uniq.size, engines.size

      engines.each do |engine|
        assert_path_exists Rails.root.join(engine.mapper_file), "#{engine.id} points at a missing mapper file"
      end
    end
  end

  describe 'the Qdrant definition' do
    let(:qdrant) { MapperBasedSearchEngine.find('qdrant') }

    # Qdrant's /points/query response carries no total, so numberOfResultsMapper can only
    # report the docs already on screen and "Peek at the next page" can never light up.
    # Naming the pagination params would also make splainer-search inject them as strings,
    # which Qdrant's API rejects - see the comments on the definition.
    it 'does not claim pagination support or name pagination params' do
      assert_not qdrant.supports_pagination
      assert_nil qdrant.pagination_hits_param
      assert_nil qdrant.pagination_offset_param
    end

    it 'ships no live endpoint, so the wizard asks for the user\'s own cluster URL' do
      assert_equal '', qdrant.search_url
      assert_includes qdrant.url_format, '/collections/'
      assert_includes qdrant.url_format, '/points/query'
    end

    # Qdrant authenticates with its own api-key header rather than HTTP Basic.
    it 'ships a placeholder api-key header rather than a real credential' do
      assert_not qdrant.supports_basic_auth
      assert_equal 'Custom', qdrant.header_type
      assert_equal({ 'api-key' => '<your-qdrant-api-key>' }, JSON.parse(qdrant.custom_headers))
    end

    it 'supports rated docs lookup, which its mapper implements' do
      assert qdrant.supports_rated_docs_lookup
      assert_includes qdrant.mapper_code, 'ratedDocsQueryParamsMapper'
    end
  end
end
