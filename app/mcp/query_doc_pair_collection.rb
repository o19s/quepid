# frozen_string_literal: true

class QueryDocPairCollection < QuepidCollection
  model QueryDocPair
  description 'One candidate document for one query inside a book.'
  fields :id, :query_text, :doc_id, :position, :information_need, :notes, :document_fields,
         :book, :created_at, :updated_at

  instructions <<~TXT
    One candidate document for one query inside a book: the unit a human or AI judge rates.
    Verdicts are in "judgement" ($match {"query_doc_pair": <id>}). "document_fields" is a JSON
    text blob, often several KB: $project it away unless you need document content.
    "position" is the rank the document had when the pair was captured.
  TXT

  def scope_for user
    QueryDocPair.where(book_id: visible_book_ids(user))
  end
end
