# frozen_string_literal: true

json.extract! search_endpoint, :id, :name, :endpoint_url, :search_engine, :custom_headers, :api_method, :archived,
              :created_at, :updated_at
json.url search_endpoint_url(search_endpoint, format: :json)
