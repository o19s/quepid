# frozen_string_literal: true

json.search_endpoints do
  json.array! @search_endpoints, partial: 'search_endpoint', as: :search_endpoint
end
