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
      id:                  'vespa',
      name:                'Vespa',
      logo:                'vespa',
      api_method:          'GET',
      proxy_requests:      true,
      # Vespa Cloud's data plane authenticates via mTLS or a bearer token (sent as a
      # custom header below), never HTTP Basic Auth, so the wizard shouldn't offer it.
      supports_basic_auth: false,
      search_url:          'https://a119b8dc.eb5f2dd2.z.vespa-app.cloud/search/',
      url_format:          'https://<app>.<tenant>.z.vespa-app.cloud/search/',
      query_params:        'yql=select * from news where title contains "#$query##" or abstract contains "#$query##"&ranking.profile=bm25',
      # Read-only Vespa Cloud data-plane token for the o19s demo tenant; scoped to query
      # access only, so exposure is bounded to someone running extra queries against the
      # demo index, not writing/deleting data.
      custom_headers:      { Authorization: 'Bearer vespa_cloud_TR8wpJb6M2x0TltmxqTdupqA20rcAI5tAEfqHWbvsx5' }.to_json,
      header_type:         'Custom',
      id_field:            'id',
      title_field:         'title',
      # Vespa's schema-agnostic match-all query — YQL's equivalent of Solr's "*:*" or
      # Elasticsearch's match_all. "sources *" searches every content source regardless
      # of schema/field names, so this works against any Vespa app, not just this demo's
      # "news" schema. Used complete, as-is (see wizardModal.js's validate()) when the
      # wizard validates the endpoint (ping-it) or discovers field names for the Fields
      # step — substituting a real search term into query_params' #$query## placeholder
      # instead would only surface fields from docs matching that specific term, and
      # wouldn't generalize to a real user's own Vespa app/content.
      test_query:          'yql=select * from sources * where true',
      mapper_file:         'db/mapper_based_search_engines/vespa.js',
    }
  ].freeze

  def self.all
    DEFINITIONS.map { |definition| new(definition) }
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
