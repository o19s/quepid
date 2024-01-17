# frozen_string_literal: true

json.query_text      query_doc_pair.query_text
json.doc_id          query_doc_pair.doc_id
json.position        query_doc_pair.position
json.document_fields query_doc_pair.document_fields
json.information_need query_doc_pair.information_need
json.notes           query_doc_pair.notes
json.options         query_doc_pair.options

json.judgements do
  json.array! query_doc_pair.judgements, partial: 'judgements', as: :judgement
end
