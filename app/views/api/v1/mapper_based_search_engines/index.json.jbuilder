# frozen_string_literal: true

json.mapper_based_search_engines @mapper_based_search_engines do |engine|
  json.id engine.id
  json.name engine.name
  json.logo engine.logo
  json.search_engine engine.search_engine
  json.api_method engine.api_method
  json.proxy_requests engine.proxy_requests
  json.supports_basic_auth engine.supports_basic_auth
  json.supports_pagination engine.supports_pagination
  json.pagination_hits_param engine.pagination_hits_param
  json.pagination_offset_param engine.pagination_offset_param
  json.search_url engine.search_url
  json.url_format engine.url_format
  json.query_params engine.query_params
  json.mapper_code engine.mapper_code
  json.custom_headers engine.custom_headers
  json.header_type engine.header_type
  json.field_spec engine.field_spec
  json.id_field engine.id_field
  json.title_field engine.title_field
  json.test_query engine.test_query
  json.additional_fields engine.additional_fields
end
