# frozen_string_literal: true

json.query do
  json.partial! 'query', query: @query
end

json.display_order @display_order
