// Searcher adapter — translates Quepid's tryConfig (snake_case, from the API)
// into splainer-search's createSearcher() options (camelCase).
//
// This bridges the Quepid data model with splainer-search's searcher factories,
// providing NormalDoc objects with .explain(), .score(), .hotMatchesOutOf(), etc.

import { createSearcher, createFieldSpec } from "splainer-search"
import { apiUrl } from "modules/api_url"

// Build the Quepid proxy URL prefix that splainer-search prepends to target URLs.
// Format: "proxy/fetch?url=" — splainer-search concatenates this with the target URL.
function buildProxyUrlPrefix() {
  return apiUrl("proxy/fetch?url=")
}

// Compile SearchAPI mapper_code into { numberOfResultsMapper, docsMapper }.
// Mirrors the approach in main's queriesSvc and this branch's search_executor.
function compileMappers(mapperCode) {
  if (!mapperCode || !String(mapperCode).trim()) return {}
  try {
    const factory = new Function(
      `${mapperCode}\nreturn {\n  numberOfResultsMapper: typeof numberOfResultsMapper !== "undefined" ? numberOfResultsMapper : null,\n  docsMapper: typeof docsMapper !== "undefined" ? docsMapper : null,\n};`,
    )
    const m = factory()
    const result = {}
    if (typeof m.numberOfResultsMapper === "function") result.numberOfResultsMapper = m.numberOfResultsMapper
    if (typeof m.docsMapper === "function") result.docsMapper = m.docsMapper
    return result
  } catch (e) {
    console.error("SearchAPI mapper_code failed:", e)
    return {}
  }
}

// Create a splainer-search searcher from a Quepid tryConfig.
//
// tryConfig is the snake_case object from the Quepid API (/api/cases/:id/tries/:try_number),
// with fields like: search_url, search_engine, field_spec, args, number_of_rows,
// custom_headers, basic_auth_credential, api_method, proxy_requests, mapper_code, options.
//
// Returns a searcher object with: .search(), .pager(), .explainOther(), .docs, .numFound, .linkUrl
export function createQuepidSearcher(tryConfig, queryText, queryOptions = {}) {
  const fieldSpec = createFieldSpec(tryConfig.field_spec)
  const args = structuredClone(tryConfig.args || {})

  // Convert custom_headers to string if it's an object
  let customHeaders = tryConfig.custom_headers
  if (typeof customHeaders === "object" && customHeaders !== null) {
    customHeaders = JSON.stringify(customHeaders)
  }

  const searcherConfig = {
    customHeaders: customHeaders,
    numberOfRows: tryConfig.number_of_rows ?? 10,
    basicAuthCredential: tryConfig.basic_auth_credential,
  }

  // API method
  if (tryConfig.api_method !== undefined) {
    searcherConfig.apiMethod = tryConfig.api_method
  }

  // Proxy — splainer-search prepends proxyUrl to target URLs
  if (tryConfig.proxy_requests !== false) {
    searcherConfig.proxyUrl = buildProxyUrlPrefix()
  }

  // Per-query options (qOption) — merged try-level + query-level
  searcherConfig.qOption = { ...(tryConfig.options || {}), ...queryOptions }

  // Engine-specific setup
  let searchEngine = (tryConfig.search_engine || "solr").toLowerCase()

  if (searchEngine === "static") {
    searchEngine = "solr"
  } else if (searchEngine === "searchapi") {
    // Compile mapper functions from user-provided mapper_code
    const mappers = compileMappers(tryConfig.mapper_code)
    if (mappers.docsMapper) searcherConfig.docsMapper = mappers.docsMapper
    if (mappers.numberOfResultsMapper) searcherConfig.numberOfResultsMapper = mappers.numberOfResultsMapper
  }

  if (searchEngine === "solr") {
    // Add echoParams=all for query details (matches main's behavior)
    if (args["echoParams"] === undefined) {
      args["echoParams"] = "all"
    }
  }

  return createSearcher(
    fieldSpec,
    tryConfig.search_url,
    args,
    queryText,
    searcherConfig,
    searchEngine,
  )
}

export { buildProxyUrlPrefix }
