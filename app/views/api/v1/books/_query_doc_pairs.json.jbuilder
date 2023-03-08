# frozen_string_literal: true

json.query_doc_pair_id  query_doc_pair.id
json.position           query_doc_pair.position
json.query              query_doc_pair.query_text
json.doc_id             query_doc_pair.doc_id

json.document_fields query_doc_pair.document_fields unless no_doc_data

json.judgements do
  json.array! query_doc_pair.judgements, partial: 'api/v1/books/judgements', as: :judgement
end
