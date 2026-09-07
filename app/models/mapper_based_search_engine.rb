# frozen_string_literal: true

# A search engine the Create-a-Case wizard can offer as a tile beyond the built-in ones
# (Solr, Elasticsearch, OpenSearch, ...). Every instance drives the wizard's generic
# search_engine: 'searchapi' type, differentiated by mapper_code: a pair of JS functions
# (numberOfResultsMapper/docsMapper) that translate the target API's response into
# Quepid's expected shape. A definition may point at a real, live demo endpoint with
# real credentials (as Vespa does below) so its tile works with zero setup; GET
# /api/mapper_based_search_engines serves every attribute here verbatim to any
# logged-in user, so only give a definition low-privilege, purpose-scoped credentials,
# never write/delete access.
class MapperBasedSearchEngine
  include ActiveModel::Model
  include ActiveModel::Attributes

  attribute :id,                  :string
  attribute :name,                :string
  attribute :logo,                :string
  attribute :search_engine,       :string, default: 'searchapi'
  attribute :api_method,          :string
  attribute :proxy_requests,      :boolean, default: false
  attribute :supports_basic_auth, :boolean, default: true
  # Whether "Peek at the next page of results" can widen the request (e.g. Vespa's
  # hits/offset). Not every search API exposes an offset concept the wizard's generic
  # query_params template can drive, so this defaults to false rather than assuming it.
  attribute :supports_pagination, :boolean, default: false
  # The query_params key names for page size / offset (e.g. Vespa's 'hits'/'offset').
  # Deliberately no default: an engine claiming supports_pagination without naming both
  # of these is a config bug we want to surface (queriesSvc.js's paginate() refuses to
  # guess a key name), not silently fall back to some other engine's convention.
  attribute :pagination_hits_param,   :string
  attribute :pagination_offset_param, :string
  attribute :search_url,          :string, default: ''
  attribute :url_format,          :string
  attribute :query_params,        :string
  attribute :custom_headers,      :string, default: ''
  attribute :header_type,         :string, default: 'None'
  attribute :field_spec,          :string
  attribute :id_field,            :string
  attribute :title_field,         :string
  attribute :test_query,          :string
  attribute :additional_fields,   default: -> { [] }
  attribute :mapper_file,         :string

  DEFINITIONS = [
    {
      id:                      'vespa',
      name:                    'Vespa',
      logo:                    'vespa',
      api_method:              'GET',
      proxy_requests:          true,
      supports_basic_auth:     false,
      # Vespa's query API takes hits/offset as plain top-level params alongside yql, so
      # queriesSvc.js's paginate() can widen the request by bumping offset on each click.
      supports_pagination:     true,
      pagination_hits_param:   'hits',
      pagination_offset_param: 'offset',
      search_url:              'https://a119b8dc.eb5f2dd2.z.vespa-app.cloud/search/',
      url_format:              'https://<app>.<tenant>.z.vespa-app.cloud/search/',
      # hits/offset are deliberately not baked in here — they'd show up in the editable
      # Query Sandbox as if they were part of the query. queriesSvc.js's
      # createSearcherFromSettings() injects them at request-build time instead (using
      # pagination_hits_param/pagination_offset_param below), the same way it already
      # injects Solr's echoParams=all without persisting it into query_params.
      query_params:            'yql=select * from movies where title contains "#$query##" or overview contains "#$query##"&ranking.profile=bm25',
      # Read-only Vespa Cloud data-plane token for the o19s demo tenant; scoped to query
      # access only, so exposure is bounded to someone running extra queries against the
      # demo index, not writing/deleting data.
      custom_headers:          { Authorization: 'Bearer vespa_cloud_TR8wpJb6M2x0TltmxqTdupqA20rcAI5tAEfqHWbvsx5' }.to_json,
      header_type:             'Custom',
      id_field:                'id',
      title_field:             'title',
      test_query:              'yql=select * from sources * where true',
      additional_fields:       [ 'overview', 'cast', 'thumb:poster_path' ],
      mapper_file:             'db/mapper_based_search_engines/vespa.js',
    }
  ].freeze

  def self.all
    DEFINITIONS.map { |definition| new(definition) }
  end

  def self.find id
    all.find { |engine| engine.id == id }
  end

  def mapper_code
    self.class.mapper_code_cache[mapper_file] ||= File.read(Rails.root.join(mapper_file))
  end

  # DEFINITIONS is a fixed, code-defined constant, so the mapper files it points at
  # never change at runtime; cache their contents instead of hitting disk on every
  # GET /api/mapper_based_search_engines request.
  def self.mapper_code_cache
    @mapper_code_cache ||= {}
  end
end
