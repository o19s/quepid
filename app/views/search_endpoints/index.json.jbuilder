# frozen_string_literal: true

json.array! @search_endpoints, partial: 'search_endpoints/search_endpoint', as: :search_endpoint
