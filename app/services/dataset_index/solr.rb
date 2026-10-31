# frozen_string_literal: true

module DatasetIndex
  # The Schema API commands that add the canonical fields to an existing collection (POST /solr/<collection>/schema),
  # using the field types of Solr's default configset. The collection itself has to exist already, and has its own id.
  class Solr
    ENGINE = 'solr'
    LABEL = 'Solr'

    # /solr/shop/select is "shop"; /solr/select has no collection in it.
    def self.index_name_from url
      name = URI.parse(url.to_s).path[%r{/([^/]+)/(?:select|query)\z}, 1]
      name unless 'solr' == name
    rescue URI::InvalidURIError
      nil
    end

    # The endpoint's URL pointed at another collection: /solr/shop/select with "wands" is /solr/wands/select.
    def self.url_with_index url, name
      uri = URI.parse(url.to_s)
      uri.path = if index_name_from(url)
                   uri.path.sub(%r{/[^/]+/(select|query)\z}, "/#{name}/\\1")
                 else
                   uri.path.sub(%r{/(select|query)\z}, "/#{name}/\\1")
                 end
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

    def self.build index_name:, vector_size: nil # rubocop:disable Lint/UnusedMethodArgument
      Definition.new(engine: ENGINE, label: LABEL, index_name: index_name, format: :json, apply: :solr, body: commands,
                     note: "These add fields to the existing collection \"#{index_name}\"; Solr cannot make the collection from here, " \
                           'and it already has an id field. title_exact and brand_text are copies of title and brand.')
    end

    def self.commands
      { 'add-field' => fields, 'add-copy-field' => [ { 'source' => 'title', 'dest' => 'title_exact' }, { 'source' => 'brand', 'dest' => 'brand_text' } ] }
    end

    # Only commands that add: an edit cannot make Quepid delete or replace a field of someone's collection.
    def self.check! body
      others = body.keys.grep_v(/\Aadd-/)
      raise InvalidDefinition, "Quepid only sends add commands to Solr (add-field, add-copy-field and the like), not #{others.join(', ')}." if others.any?
    end

    def self.fields
      [
        field('title', 'text_general'), field('title_exact', 'string'),
        field('description', 'text_general'),
        field('thumb', 'string', 'indexed' => false),
        field('brand', 'string'), field('brand_text', 'text_general'),
        field('price', 'pfloat'), field('rating', 'pfloat'),
        field('category', 'string', 'multiValued' => true)
      ]
    end

    def self.field name, type, extra = {}
      { 'name' => name, 'type' => type, 'stored' => true, 'indexed' => true }.merge(extra)
    end
  end
end
