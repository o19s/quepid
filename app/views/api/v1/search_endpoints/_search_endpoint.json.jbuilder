# frozen_string_literal: true

shallow ||= false

json.name                   search_endpoint.fullname
json.search_endpoint_id     search_endpoint.id
json.endpoint_url           search_endpoint.endpoint_url
json.search_engine          search_endpoint.search_engine
unless shallow
  json.api_method           search_endpoint.api_method
  json.custom_headers       search_endpoint.custom_headers
end
