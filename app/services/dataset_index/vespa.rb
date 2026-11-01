# frozen_string_literal: true

module DatasetIndex
  # A Vespa schema file. Vespa takes schemas as part of an application package that is deployed as a whole, which
  # Quepid does not do, so this is only shown.
  class Vespa
    ENGINE = 'vespa'
    LABEL = 'Vespa'

    def self.index_name_from _url
      nil
    end

    def self.valid_name? name
      name.match?(/\A[a-z][a-z0-9_]*\z/)
    end

    def self.fallback_name dataset_key
      "quepid_#{dataset_key.to_s.underscore}"
    end

    def self.build index_name:, vector_size: nil # rubocop:disable Lint/UnusedMethodArgument
      Definition.new(engine: ENGINE, label: LABEL, index_name: index_name, format: :text, body: schema(index_name), apply: nil,
                     note: 'Vespa schemas are deployed as part of an application package, which Quepid cannot do. ' \
                           "Save this as schemas/#{index_name}.sd in your application package and deploy it.")
    end

    def self.schema name
      <<~SD
        schema #{name} {
          document #{name} {
            field id type string {
              indexing: summary | attribute
            }
            field title type string {
              indexing: summary | index
              index: enable-bm25
            }
            field description type string {
              indexing: summary | index
              index: enable-bm25
            }
            field thumb type string {
              indexing: summary
            }
            field brand type string {
              indexing: summary | index | attribute
              index: enable-bm25
            }
            field price type float {
              indexing: summary | attribute
            }
            field rating type float {
              indexing: summary | attribute
            }
            field category type array<string> {
              indexing: summary | attribute
            }
          }
          fieldset default {
            fields: title, description, brand
          }
          rank-profile default {
            first-phase {
              expression: bm25(title) + bm25(description) + bm25(brand)
            }
          }
        }
      SD
    end
  end
end
