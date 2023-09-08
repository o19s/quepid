# frozen_string_literal: true

json.args           try.args
json.curator_vars   try.curator_vars_map
json.escape_query   try.escape_query
json.field_spec     try.field_spec
json.name           try.name
json.number_of_rows try.number_of_rows
json.query_params   try.query_params
json.search_endpoint_id try.search_endpoint&.id
json.endpoint_name  try.search_endpoint&.fullname
json.custom_headers try.search_endpoint&.custom_headers
json.api_method     try.search_endpoint&.api_method
json.search_engine  try.search_endpoint&.search_engine
json.search_url     try.search_endpoint&.endpoint_url
json.try_number     try.try_number
if try.search_endpoint.present?
  json.search_endpoint do
    json.partial! 'api/v1/search_endpoints/search_endpoint', search_endpoint: try.search_endpoint
  end
end
