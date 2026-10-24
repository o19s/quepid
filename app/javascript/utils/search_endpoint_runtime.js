import { getJson } from "api/json"
import { isEsLikeEngine } from "utils/search_engines"

function mapSearchEndpoint(data) {
  return {
    id: data.search_endpoint_id,
    name: data.name,
    searchEngine: data.search_engine,
    endpointUrl: data.endpoint_url,
    apiMethod: data.api_method,
    customHeaders: data.custom_headers,
    proxyRequests: data.proxy_requests,
    basicAuthCredential: data.basic_auth_credential,
    mapperCode: data.mapper_code,
    testQuery: data.test_query,
    mapperBasedSearchEngineId: data.mapper_based_search_engine_id
  }
}

export function createSearchEndpointRuntime() {
  let searchEndpoints = []

  async function load(url) {
    searchEndpoints = []
    const data = await getJson(url)
    const seen = new Set()
    searchEndpoints = (data.search_endpoints || []).map(mapSearchEndpoint).filter((endpoint) => {
      if (seen.has(endpoint.id)) return false
      seen.add(endpoint.id)
      return true
    })
    return searchEndpoints
  }

  return {
    list: () => load("api/search_endpoints"),
    fetchForCase: (caseNo) => load(`api/cases/${caseNo}/search_endpoints`),
    all: () => searchEndpoints,
    isEsOrOsEngine: isEsLikeEngine,
    usesJsonQueryParams: (searchEngine) =>
      isEsLikeEngine(searchEngine) || searchEngine === "vectara" || searchEngine === "algolia",
    reset: () => {
      searchEndpoints = []
    }
  }
}
