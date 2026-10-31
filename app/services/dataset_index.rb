# frozen_string_literal: true

# Turns the CanonicalDatasetIndexSchema into the definition of an index for a search endpoint's engine (the JSON, or
# for Vespa the schema file, you would give that engine to make an index that holds the schema's documents), and can
# create the index for the engines where Quepid knows how.
#
#   definition = DatasetIndex.build(endpoint: endpoint, dataset: entry)
#   definition.text          # what to show the user
#   DatasetIndex::Applier.new(endpoint).apply(definition) if definition.apply
module DatasetIndex
  class Error < StandardError; end
  class Unsupported < Error; end
  class AlreadyExists < Error; end
  class InvalidDefinition < Error; end

  # The longest definition text Quepid will take back from an edit.
  MAX_TEXT_LENGTH = 200_000

  # [engine id, builder]. The id is what the endpoint stores: its search_engine, or for a mapper-based engine such
  # as Vespa and Qdrant the id of that engine.
  BUILDERS = {
    'es'      => Elasticsearch,
    'os'      => OpenSearch,
    'solr'    => Solr,
    'qdrant'  => Qdrant,
    'vespa'   => Vespa,
    'algolia' => Algolia,
    'vectara' => Vectara,
  }.freeze

  # What a builder returns. apply is nil when Quepid cannot create the index itself, else which way to (see Applier);
  # note says why not, or what to watch for.
  Definition = Struct.new(:engine, :label, :index_name, :format, :body, :apply, :note, keyword_init: true) do
    def text
      :json == format ? JSON.pretty_generate(body) : body
    end

    def applicable?
      apply.present?
    end

    # The same definition with what the user made of it: another index name and another body (JSON text). It is
    # checked first, because it is what will be sent to the endpoint: the name goes into its address, and the body
    # has to be the shape this engine's apply expects.
    def edited index_name:, text:
      raise InvalidDefinition, "Quepid can only edit JSON definitions, and this #{label} one is not." unless :json == format
      raise InvalidDefinition, 'The definition is too long.' if text.to_s.length > MAX_TEXT_LENGTH

      builder = BUILDERS.fetch(engine)
      name = index_name.to_s.strip
      raise InvalidDefinition, 'Give the index a name.' if name.empty?
      raise InvalidDefinition, "#{name.inspect} is not a name #{label} accepts for an index." unless builder.valid_name?(name)

      copy = dup
      copy.index_name = name
      copy.body = parse_body(text)
      builder.check!(copy.body) if builder.respond_to?(:check!)
      copy
    end

    private

    def parse_body text
      body = JSON.parse(text.to_s)
      raise InvalidDefinition, 'The definition must be a JSON object.' unless body.is_a?(Hash)

      body
    rescue JSON::ParserError => e
      raise InvalidDefinition, "The definition is not valid JSON: #{e.message.lines.first.to_s.squish.truncate(160)}"
    end
  end

  def self.engine_id endpoint
    endpoint.mapper_based_search_engine_id.presence || endpoint.search_engine.to_s
  end

  def self.builder_for endpoint
    BUILDERS[engine_id(endpoint)]
  end

  def self.supported? endpoint
    !builder_for(endpoint).nil?
  end

  # The index to make: the one the endpoint's URL names (/tmdb/_search is "tmdb"), or if it names none, one named
  # after the dataset.
  def self.index_name endpoint, dataset
    builder = builder_for(endpoint) or raise Unsupported, "Quepid has no index definition for #{SearchEngine.label(endpoint.search_engine)} endpoints."
    named = builder.index_name_from(endpoint.endpoint_url)
    named && builder.valid_name?(named) ? named : builder.fallback_name(dataset.key)
  end

  # A copy of the endpoint for the user that searches the index instead (its address names it), with the same connection
  # details; nil when the engine's address cannot name an index, so nothing can be copied.
  def self.endpoint_for_index endpoint, index_name, owner
    builder = builder_for(endpoint)
    return unless builder.respond_to?(:url_with_index)

    url = builder.url_with_index(endpoint.endpoint_url, index_name) or return
    copy = endpoint.dup
    copy.assign_attributes(owner: owner, endpoint_url: url, name: "#{endpoint.name.presence || SearchEngine.label(endpoint.search_engine)} (#{index_name})",
                           archived: false)
    copy
  end

  # vector_size: how long the vectors are, for the engines that need to know up front (Qdrant); the dimensions of
  # the embedder the case uses.
  def self.build endpoint:, dataset:, vector_size: nil
    builder = builder_for(endpoint) or raise Unsupported, "Quepid has no index definition for #{SearchEngine.label(endpoint.search_engine)} endpoints."
    builder.build(index_name: index_name(endpoint, dataset), vector_size: vector_size)
  end
end
