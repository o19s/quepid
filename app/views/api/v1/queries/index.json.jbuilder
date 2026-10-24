# frozen_string_literal: true

json.queries do
  json.array! @queries, partial: 'query', as: :query, embedder: @case.embedder
end

json.display_order @display_order
