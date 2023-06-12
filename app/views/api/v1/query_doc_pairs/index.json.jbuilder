# frozen_string_literal: true

json.all_cases do
  json.array! @query_doc_pairs, partial: 'query_doc_pair', as: :query_doc_pair, locals: {}
end
