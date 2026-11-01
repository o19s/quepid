# frozen_string_literal: true

# The one document shape every example dataset is turned into before it goes into a search index, whatever the
# dataset's own fields are called: an id, a title, a description, a thumbnail, a brand, a price, a rating and
# categories. A dataset says how to fill these in with a DatasetDocumentMapper; DatasetIndex turns the schema
# into the index definition for a search engine.
#
# Every field except the id may be missing from a document. Source fields that no mapping uses are dropped.
module CanonicalDatasetIndexSchema
  # type: :id and :keyword are exact values, :text is analysed for search, :url is a link (kept, not searched),
  # :number is a decimal. multi: the field may hold a list. keyword_subfield: also keep the exact value for sorting;
  # text_subfield: also make a keyword searchable as text.
  Field = Struct.new(:name, :type, :multi, :keyword_subfield, :text_subfield, :description, keyword_init: true)

  FIELDS = [
    Field.new(name: 'id', type: :id, description: 'The document id, as the dataset names it.'),
    Field.new(name: 'title', type: :text, keyword_subfield: true, description: 'What the document is called.'),
    Field.new(name: 'description', type: :text, description: 'Longer text about it.'),
    Field.new(name: 'thumb', type: :url, description: 'Link to a small picture.'),
    Field.new(name: 'brand', type: :keyword, text_subfield: true, description: 'Who makes it.'),
    Field.new(name: 'price', type: :number, description: 'What it costs.'),
    Field.new(name: 'rating', type: :number, description: 'How well it is rated.'),
    Field.new(name: 'category', type: :keyword, multi: true, description: 'What kind of thing it is; there can be several.')
  ].freeze

  # The fields a dataset fills in (the id comes from the document itself).
  def self.mappable_fields
    FIELDS.reject { |field| 'id' == field.name }
  end

  def self.field name
    FIELDS.find { |field| field.name == name.to_s }
  end
end
