# frozen_string_literal: true

module DatasetIndex
  # Algolia has no schema: an index appears with its first record. What it can be given up front are settings, which
  # say what is searched, filtered on and used to rank. Quepid does not apply them.
  class Algolia
    ENGINE = 'algolia'
    LABEL = 'Algolia'

    def self.index_name_from url
      URI.parse(url.to_s).path[%r{/1/indexes/([^/?]+)}, 1]
    rescue URI::InvalidURIError
      nil
    end

    def self.valid_name? name
      name.match?(%r{\A[^\s/]+\z})
    end

    def self.fallback_name dataset_key
      "quepid-#{dataset_key.to_s.dasherize}"
    end

    def self.build index_name:, vector_size: nil # rubocop:disable Lint/UnusedMethodArgument
      Definition.new(engine: ENGINE, label: LABEL, index_name: index_name, format: :json, apply: nil,
                     body: { 'searchableAttributes'  => %w[title description brand category],
                             'attributesForFaceting' => [ 'searchable(brand)', 'searchable(category)' ],
                             'customRanking'         => [ 'desc(rating)' ],
                             'attributesToRetrieve'  => CanonicalDatasetIndexSchema::FIELDS.map(&:name) },
                     note: 'Algolia makes the index when the first record arrives. These are the settings to give it, ' \
                           'which Quepid cannot apply from here.')
    end
  end
end
