# frozen_string_literal: true

no_doc_data ||= true

json.name        book.name
json.book_id     book.id

json.query_doc_pairs do
  json.array! book.query_doc_pairs, partial: 'api/v1/books/query_doc_pairs', as: :query_doc_pair,
no_doc_data: no_doc_data
end
