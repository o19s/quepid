# frozen_string_literal: true

json.custom_headers try.custom_headers
json.escape_query   try.escape_query
json.api_method     try.api_method
json.field_spec     try.field_spec
json.name           try.name
json.number_of_rows try.number_of_rows
json.query_params   try.query_params
json.search_engine  try.search_engine
json.search_url     try.search_url

json.curator_variables do
  json.array! try.curator_variables, partial: 'curator_variable', as: :curator_variable
end
