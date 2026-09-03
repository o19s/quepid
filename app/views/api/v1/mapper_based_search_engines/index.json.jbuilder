# frozen_string_literal: true

json.mapper_based_search_engines @mapper_based_search_engines do |engine|
  json.id               engine.id
  json.name             engine.name
  json.logo             engine.logo
  json.searchEngine     engine.search_engine
  json.apiMethod        engine.api_method
  json.proxyRequests    engine.proxy_requests
  json.supportsBasicAuth engine.supports_basic_auth
  json.searchUrl        engine.search_url
  json.urlFormat        engine.url_format
  json.queryParams      engine.query_params
  json.mapperCode       engine.mapper_code
  json.customHeaders    engine.custom_headers
  json.headerType       engine.header_type
  json.fieldSpec        engine.field_spec
  json.idField          engine.id_field
  json.titleField       engine.title_field
  json.testQuery        engine.test_query
  json.additionalFields engine.additional_fields
end
