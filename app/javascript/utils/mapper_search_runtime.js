import { getJson } from "api/json"

function mapEngine(data) {
  return {
    id: data.id,
    name: data.name,
    logo: data.logo,
    searchEngine: data.search_engine,
    apiMethod: data.api_method,
    proxyRequests: data.proxy_requests,
    supportsBasicAuth: data.supports_basic_auth,
    supportsPagination: data.supports_pagination,
    paginationHitsParam: data.pagination_hits_param,
    paginationOffsetParam: data.pagination_offset_param,
    searchUrl: data.search_url,
    urlFormat: data.url_format,
    queryParams: data.query_params,
    bareQueryParam: data.bare_query_param,
    mapperCode: data.mapper_code,
    customHeaders: data.custom_headers,
    headerType: data.header_type,
    fieldSpec: data.field_spec,
    idField: data.id_field,
    titleField: data.title_field,
    testQuery: data.test_query,
    additionalFields: data.additional_fields
  }
}

export function createMapperSearchRuntime() {
  let engines = []

  return {
    list: async () => {
      const data = await getJson("api/mapper_based_search_engines")
      engines = (data.mapper_based_search_engines || []).map(mapEngine)
      return engines
    },
    all: () => engines,
    reset: () => {
      engines = []
    }
  }
}
