# frozen_string_literal: true

module DatasetIndex
  # A Qdrant collection (PUT /collections/<name>) with one named vector, then an index for each payload field that is
  # searched or filtered on (PUT /collections/<name>/index). Qdrant wants the vector size up front, so this can only
  # be applied when it is known: the dimensions of the embedder the case uses.
  class Qdrant
    ENGINE = 'qdrant'
    LABEL = 'Qdrant'
    VECTOR_NAME = 'dense'

    # Payload field => Qdrant's type for it. The thumbnail is only kept, so it has no index.
    PAYLOAD_INDEXES = { 'id' => 'keyword', 'title' => 'text', 'description' => 'text', 'brand' => 'keyword',
                        'category' => 'keyword', 'price' => 'float', 'rating' => 'float' }.freeze

    def self.index_name_from url
      URI.parse(url.to_s).path[%r{/collections/([^/]+)}, 1]
    rescue URI::InvalidURIError
      nil
    end

    # The endpoint's URL pointed at another collection: /collections/shop/points/query with "wands" is
    # /collections/wands/points/query. Nil when it names none, as there is then no telling where the name goes.
    def self.url_with_index url, name
      return unless index_name_from(url)

      uri = URI.parse(url.to_s)
      uri.path = uri.path.sub(%r{/collections/[^/]+}, "/collections/#{name}")
      uri.to_s
    rescue URI::InvalidURIError
      nil
    end

    def self.valid_name? name
      name.match?(/\A[A-Za-z0-9_-]+\z/)
    end

    def self.fallback_name dataset_key
      "quepid-#{dataset_key.to_s.dasherize}"
    end

    def self.build index_name:, vector_size: nil
      Definition.new(engine: ENGINE, label: LABEL, index_name: index_name, format: :json, apply: (:qdrant if vector_size), note: note(vector_size),
                     body: { 'collection'      => { 'vectors' => { VECTOR_NAME => { 'size' => vector_size, 'distance' => 'Cosine' } } },
                             'payload_indexes' => PAYLOAD_INDEXES.map { |name, type| { 'field_name' => name, 'field_schema' => type } } })
    end

    # The two parts Quepid sends: the collection, then an index for each payload field.
    def self.check! body
      raise InvalidDefinition, 'The definition needs a "collection" object with the vectors.' unless body['collection'].is_a?(Hash) && body['collection']['vectors'].present?

      indexes = body['payload_indexes']
      valid = indexes.is_a?(Array) && indexes.all? { |index| index.is_a?(Hash) && index['field_name'].is_a?(String) && index['field_schema'].is_a?(String) }
      raise InvalidDefinition, 'The "payload_indexes" must be a list of objects with a field_name and a field_schema.' unless valid
    end

    def self.note vector_size
      return "The vector is #{vector_size} numbers long, the dimensions of the case's embedder." if vector_size

      'Qdrant needs to know how long the vectors are before it makes a collection. The case has no embedder with known ' \
        'dimensions, so this cannot be applied yet: give the case an embedder that has them.'
    end
  end
end
