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
  end
end
