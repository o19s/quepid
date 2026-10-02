# frozen_string_literal: true

require 'test_helper'

class SearchEngineTest < ActiveSupport::TestCase
  it 'labels known engine ids and falls back to the id' do
    assert_equal 'Elasticsearch', SearchEngine.label('es')
    assert_equal 'Static File', SearchEngine.label(:static)
    assert_equal 'vespa', SearchEngine.label('vespa')
  end

  it 'builds [label, id] select options for every engine' do
    assert_equal SearchEngine::LABELS.keys, SearchEngine.select_options.map(&:last)
    assert_includes SearchEngine.select_options, [ 'Search API', 'searchapi' ]
  end
end
