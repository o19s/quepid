# frozen_string_literal: true

json.array! @query_doc_pairs, partial: 'query_doc_pairs/query_doc_pair', as: :query_doc_pair
