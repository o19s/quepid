/** Format object headers without parsing or normalizing other values. */
export function formatEndpointHeaders(value) {
  return value !== null && typeof value === "object" ? JSON.stringify(value, null, 2) : value
}

/** Fields shared by endpoint selection; caller-specific defaults stay with callers. */
export function endpointSettings(endpoint) {
  return {
    searchEndpointId: endpoint.id,
    searchEngine: endpoint.searchEngine,
    searchUrl: endpoint.endpointUrl,
    apiMethod: endpoint.apiMethod,
    customHeaders: formatEndpointHeaders(endpoint.customHeaders),
    proxyRequests: endpoint.proxyRequests,
    basicAuthCredential: endpoint.basicAuthCredential,
    mapperCode: endpoint.mapperCode
  }
}
