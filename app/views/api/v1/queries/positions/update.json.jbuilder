# frozen_string_literal: true

json.query do
  json.partial! 'api/v1/queries/query', query: @query
end

json.display_order @display_order
