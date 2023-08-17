# frozen_string_literal: true

json.args           try.args
json.custom_headers try.search_endpoint&.custom_headers
json.curator_vars   try.curator_vars_map
json.escape_query   try.escape_query
json.api_method     try.search_endpoint&.api_method
json.field_spec     try.field_spec
json.name           try.name
json.number_of_rows try.number_of_rows
json.query_params   try.query_params
json.search_engine  try.search_endpoint&.search_engine
json.search_url     try.search_endpoint&.endpoint_url
json.try_number     try.try_number
