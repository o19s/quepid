# frozen_string_literal: true

# The built-in search engines, keyed by the id stored in `search_engine` on search
# endpoints and tries. This is the one list of engines and their display labels:
# views render their engine <select>s from it, and pass `SearchEngine::LABELS` to
# Stimulus controllers that name an engine. Mapper-based engines
# (MapperBasedSearchEngine) all use the generic 'searchapi' id and carry their own name.
#
# Per-engine behavior on the browser side (ES-like query DSL, lookup by id, treating
# static as Solr) lives in app/javascript/utils/search_engines.js.
module SearchEngine
  LABELS = {
    'solr'      => 'Solr',
    'es'        => 'Elasticsearch',
    'os'        => 'OpenSearch',
    'vectara'   => 'Vectara',
    'algolia'   => 'Algolia',
    'static'    => 'Static File',
    'searchapi' => 'Search API',
  }.freeze

  def self.label id
    LABELS[id.to_s] || id.to_s
  end

  # [label, id] pairs, the shape options_for_select expects.
  def self.select_options
    LABELS.map { |id, label| [ label, id ] }
  end
end
