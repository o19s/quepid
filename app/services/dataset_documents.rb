# frozen_string_literal: true

# The documents of a dataset case in the canonical shape, ready to index. Where they come from depends on the
# dataset (DatasetCatalog::Entry#documents_from): Haystack keeps each document's fields in the judgement book of a
# case made from it, and WANDS' are in its product file, which is downloaded when they are indexed. IMDb's are not in
# Quepid at all, so there is nothing to index for it.
module DatasetDocuments
  # Are there documents to index for this case?
  def self.available? entry, kase
    return true if from_wands?(entry)

    from_book?(entry) && sources(kase).any?
  end

  # How many distinct documents there are.
  def self.count entry, kase
    return entry.document_total.to_i if from_wands?(entry)

    from_book?(entry) ? sources(kase).size : 0
  end

  # The documents, each once, as the dataset's mapper makes them: a list for a book's, and for WANDS' 43,000 one that
  # reads the product file as it is gone through, so they are not all held at once.
  def self.canonical entry, kase
    return wands_documents(entry) if from_wands?(entry)
    return [] unless from_book?(entry)

    sources(kase).map { |doc_id, fields| entry.mapper.map(fields, id: doc_id) }
  end

  def self.wands_documents entry
    Enumerator.new do |documents|
      WandsData.each_row(:product) { |row| documents << entry.mapper.map(row, id: row['product_id']) }
    end
  end
  private_class_method :wands_documents

  def self.from_wands? entry
    entry&.mapper.present? && :wands == entry.documents_from
  end
  private_class_method :from_wands?

  def self.from_book? entry
    entry&.mapper.present? && :book == entry.documents_from
  end
  private_class_method :from_book?

  # [document id, its fields] from the case's book, once per document, leaving out pairs that have no fields.
  def self.sources kase
    return [] unless kase.book

    kase.book.query_doc_pairs.pluck(:doc_id, :document_fields)
      .filter_map { |doc_id, fields| (parsed = fields_of(fields)).present? ? [ doc_id, parsed ] : nil }
      .uniq(&:first)
  end
  private_class_method :sources

  # The model may hand the fields over parsed (a hash) or as the JSON text they are stored as; nil if they are neither.
  def self.fields_of fields
    return fields if fields.is_a?(Hash)

    parsed = JSON.parse(fields.to_s)
    parsed if parsed.is_a?(Hash)
  rescue JSON::ParserError
    nil
  end
  private_class_method :fields_of
end
