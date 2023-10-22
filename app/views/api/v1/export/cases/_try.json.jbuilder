# frozen_string_literal: true

json.escape_query   try.escape_query
json.field_spec     try.field_spec
json.name           try.name
json.number_of_rows try.number_of_rows
json.query_params   try.query_params

json.curator_variables do
  json.array! try.curator_variables, partial: 'curator_variable', as: :curator_variable
end

if try.search_endpoint.present?
  json.search_endpoint do
    json.partial! 'api/v1/search_endpoints/search_endpoint', search_endpoint: try.search_endpoint, export: true
  end
end
