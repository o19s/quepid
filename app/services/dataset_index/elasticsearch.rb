# frozen_string_literal: true

module DatasetIndex
  # PUT /<index> with settings and mappings. The mapping is strict: only the canonical fields can be indexed.
  class Elasticsearch
    ENGINE = 'es'
    LABEL = 'Elasticsearch'

    def self.index_name_from url
      URI.parse(url.to_s).path[%r{\A/([^/_][^/]*)/_search}, 1]
    rescue URI::InvalidURIError
      nil
    end

    # The endpoint's URL pointed at another index: /tmdb/_search with "wands" is /wands/_search, and /_search gains one.
    def self.url_with_index url, name
      uri = URI.parse(url.to_s)
      uri.path = uri.path.sub(%r{\A/(?:[^/_][^/]*/)?_search}, "/#{name}/_search")
      uri.to_s
    rescue URI::InvalidURIError
      nil
    end

    # Lowercase, no spaces or / \ * ? " < > | , #, and not starting with - _ +.
    def self.valid_name? name
      name.match?(/\A[a-z0-9][a-z0-9._-]*\z/) && name.bytesize <= 255
    end

    def self.fallback_name dataset_key
      "quepid-#{dataset_key.to_s.dasherize}"
    end

    def self.build index_name:, vector_size: nil # rubocop:disable Lint/UnusedMethodArgument
      Definition.new(engine: self::ENGINE, label: self::LABEL, index_name: index_name, format: :json, apply: :elasticsearch,
                     body: { 'settings' => settings, 'mappings' => mappings },
                     note: 'A single shard and no replica, which suits an example index; raise them for anything bigger. ' \
                           'Documents with other fields are refused.')
    end

    def self.settings
      { 'number_of_shards' => 1, 'number_of_replicas' => 0 }
    end

    def self.mappings
      { 'dynamic' => 'strict', 'properties' => CanonicalDatasetIndexSchema::FIELDS.to_h { |field| [ field.name, property(field) ] } }
    end

    def self.property field
      case field.type
      when :text
        { 'type' => 'text' }.tap { |property| property['fields'] = { 'keyword' => { 'type' => 'keyword', 'ignore_above' => 256 } } if field.keyword_subfield }
      when :url then { 'type' => 'keyword', 'index' => false, 'doc_values' => false }
      when :number then { 'type' => 'float' }
      else
        { 'type' => 'keyword' }.tap { |property| property['fields'] = { 'text' => { 'type' => 'text' } } if field.text_subfield }
      end
    end
  end

  # OpenSearch takes the same settings and mappings.
  class OpenSearch < Elasticsearch
    ENGINE = 'os'
    LABEL = 'OpenSearch'
  end
end
