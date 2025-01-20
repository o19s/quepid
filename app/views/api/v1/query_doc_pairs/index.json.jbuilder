# frozen_string_literal: true

json.query_doc_pairs do
  json.array! @query_doc_pairs, partial: 'query_doc_pair', as: :query_doc_pair, locals: {}
end
