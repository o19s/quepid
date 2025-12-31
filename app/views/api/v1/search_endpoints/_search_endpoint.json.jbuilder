# frozen_string_literal: true

export ||= false

json.name                   search_endpoint.fullname
json.search_endpoint_id     search_endpoint.id unless export
json.endpoint_url           search_endpoint.endpoint_url
json.search_engine          search_endpoint.search_engine
json.api_method             search_endpoint.api_method
json.custom_headers         search_endpoint.custom_headers
json.basic_auth_credential  search_endpoint.basic_auth_credential
json.mapper_code            search_endpoint.mapper_code
json.proxy_requests         search_endpoint.proxy_requests
json.archived               search_endpoint.archived unless export

json.options search_endpoint.options if export
