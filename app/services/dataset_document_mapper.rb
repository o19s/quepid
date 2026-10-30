# frozen_string_literal: true

# Turns one of a dataset's own documents into a CanonicalDatasetIndexSchema document. A dataset has a subclass that
# says, field by field, where the value comes from:
#
#   class Haystack < DatasetDocumentMapper
#     title    first_of(:title, :name)
#     brand    from(:brand)
#     category from(:product_type)
#   end
#
# The helpers are from, first_of, join, number and split, and compute for anything else:
#
#   description compute('year and genres', uses: [ :year, :genres ]) { |doc| "#{doc['year']}, #{doc['genres']}" }
#
# Fields the mapper does not mention stay out of the document, and source fields that no rule uses are dropped.
# Values are cleaned up: text is trimmed, blanks are dropped, numbers are parsed, and a field that may hold a
# list always gets one.
class DatasetDocumentMapper
  Rule = Struct.new(:description, :sources, :call, keyword_init: true)

  # One class method per canonical field, to say where it comes from: `title first_of(:title, :name)`.
  CanonicalDatasetIndexSchema.mappable_fields.each do |field|
    define_singleton_method(field.name) { |rule| rules[field.name] = rule }
  end

  class << self
    # The canonical field => rule pairs of this mapper.
    def rules
      @rules ||= {}
    end

    # Text in the source that means "no value" (besides blank), such as IMDb's \N.
    def null_values *values
      @null_values = values.flatten unless values.empty?
      @null_values || []
    end

    def from source
      Rule.new(description: "`#{source}`", sources: [ source.to_s ], call: ->(doc) { doc[source.to_s] })
    end

    def first_of *sources
      names = sources.map(&:to_s)
      Rule.new(description: "the first of #{names.map { |name| "`#{name}`" }.join(', ')} that has a value", sources: names,
               call: ->(doc) { names.map { |name| doc[name] }.find(&:present?) })
    end

    def join *sources, with: ' '
      names = sources.map(&:to_s)
      Rule.new(description: "#{names.map { |name| "`#{name}`" }.join(' and ')}, joined with \"#{with}\"", sources: names,
               call: ->(doc) { names.map { |name| doc[name] }.compact_blank.join(with) })
    end

    def number source
      Rule.new(description: "`#{source}` as a number", sources: [ source.to_s ], call: ->(doc) { doc[source.to_s] })
    end

    def split source, separator
      Rule.new(description: "`#{source}` split on \"#{separator}\"", sources: [ source.to_s ],
               call: ->(doc) { doc[source.to_s].to_s.split(separator) })
    end

    # For anything the helpers cannot say. `uses` names the source fields it reads, for the description of the mapping.
    def compute description, uses: [], &block
      Rule.new(description: description, sources: uses.map(&:to_s), call: block)
    end

    # [canonical field, how it is filled] for each field this mapper fills, in the schema's order.
    def describe
      CanonicalDatasetIndexSchema.mappable_fields.filter_map { |field| [ field.name, rules[field.name].description ] if rules[field.name] }
    end

    # The canonical document for one source document, with the given id.
    def map source, id:
      doc = source.to_h.stringify_keys
      mapped = { 'id' => id.to_s }
      CanonicalDatasetIndexSchema.mappable_fields.each do |field|
        rule = rules[field.name]
        value = rule && clean(field, rule.call.call(doc))
        mapped[field.name] = value unless value.nil?
      end
      mapped
    end

    private

    def clean field, value
      return clean_list(field, value) if field.multi

      case field.type
      when :number then number_or_nil(value)
      else text_or_nil(value)
      end
    end

    def clean_list field, value
      list = Array(value).filter_map { |item| 'number' == field.type.to_s ? number_or_nil(item) : text_or_nil(item) }.uniq
      list.presence
    end

    def text_or_nil value
      text = value.to_s.strip
      text.empty? || null_values.include?(text) ? nil : text
    end

    def number_or_nil value
      text = text_or_nil(value)
      text && Float(text, exception: false)
    end
  end
end
