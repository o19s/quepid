# frozen_string_literal: true

json.queries do
  json.array! @queries, partial: 'api/v1/queries/query', as: :query
end

json.display_order @display_order
