# frozen_string_literal: true

module DatasetIndex
  # A Vectara corpus. The text to search goes in as documents; what the corpus knows up front are the attributes a
  # query can filter on. Quepid does not apply it.
  class Vectara
    ENGINE = 'vectara'
    LABEL = 'Vectara'

    def self.index_name_from _url
      nil
    end

    def self.valid_name? name
      name.match?(/\A[A-Za-z0-9_-]+\z/)
    end

    def self.fallback_name dataset_key
      "quepid-#{dataset_key.to_s.dasherize}"
    end

    def self.build index_name:, vector_size: nil # rubocop:disable Lint/UnusedMethodArgument
      Definition.new(engine: ENGINE, label: LABEL, index_name: index_name, format: :json, apply: nil,
                     body: { 'key' => index_name, 'name' => index_name,
                             'description' => 'Example dataset documents in the shape of Quepid\'s canonical dataset index schema.',
                             'filter_attributes' => [ attribute('brand', 'text'), attribute('category', 'list[text]'),
                                                      attribute('price', 'real_number'), attribute('rating', 'real_number') ] },
                     note: 'The title and description are the text of each document. Quepid cannot create the corpus from here.')
    end

    def self.attribute name, type
      { 'name' => name, 'level' => 'document', 'type' => type, 'indexed' => true }
    end
  end
end
