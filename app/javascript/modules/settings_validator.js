// Settings validator — replaces Angular SettingsValidatorFactory from splainer-search.
// Executes a probe search against a configured endpoint and discovers available fields.

import { apiUrl } from "modules/api_url"

// Build a proxied fetch URL
function buildProxyUrl(targetUrl) {
  return apiUrl(`proxy/fetch?url=${encodeURIComponent(targetUrl)}`)
}

// Build request headers for proxied/direct requests
function buildHeaders(config) {
  const headers = { "Content-Type": "application/json" }

  if (config.customHeaders) {
    try {
      const custom =
        typeof config.customHeaders === "string"
          ? JSON.parse(config.customHeaders)
          : config.customHeaders
      Object.assign(headers, custom)
    } catch {
      // ignore malformed headers
    }
  }

  if (config.basicAuthCredential) {
    headers["Authorization"] = "Basic " + btoa(config.basicAuthCredential)
  }

  return headers
}

// Fetch with optional proxy.
// Mirrors search_executor.js fetchWithCorsFallback: on CORS fallback for GET
// requests, strip custom headers (the proxy controller handles them upstream).
async function proxyFetch(url, options, useProxy) {
  if (useProxy) {
    return fetch(buildProxyUrl(url), options)
  }

  try {
    return await fetch(url, options)
  } catch (err) {
    if (err instanceof TypeError) {
      // CORS / network error — retry via proxy
      const proxyOpts = { ...options }
      if (!options.method || options.method === "GET") {
        proxyOpts.headers = {}
      }
      return fetch(buildProxyUrl(url), proxyOpts)
    }
    throw err
  }
}

// Extract the "source" fields from a single document, per engine type.
// Mirrors SettingsValidatorFactory.sourceDoc() from splainer-search.
function sourceDoc(doc, engine) {
  if (engine === "solr" || engine === "searchapi" || engine === "algolia") {
    return doc
  }
  if (engine === "es" || engine === "os") {
    return doc._source || doc
  }
  if (engine === "vectara" && doc.metadata) {
    const fields = doc.metadata.reduce((map, obj) => {
      map[obj.name] = obj.value
      return map
    }, {})
    return Object.assign({}, { id: doc.id }, fields)
  }
  return doc
}

// Validate a search endpoint by running a probe search.
// Returns { fields: string[], idFields: string[] } on success, throws on failure.
export async function validateEndpoint(config) {
  const engine = (config.searchEngine || "solr").toLowerCase()
  const searchUrl = config.searchUrl
  const useProxy = config.proxyRequests !== false
  const headers = buildHeaders(config)

  let response

  if (engine === "solr") {
    // Solr: GET with q=*:*  — omit Content-Type (invalid on GET requests)
    const { "Content-Type": _, ...getHeaders } = headers
    const probeUrl =
      searchUrl +
      (searchUrl.includes("?") ? "&" : "?") +
      "q=*%3A*&rows=10&wt=json"
    response = await proxyFetch(probeUrl, { headers: getHeaders }, useProxy)
  } else if (engine === "es" || engine === "os") {
    // ES/OS: POST with match_all
    const body = JSON.stringify({
      query: { match_all: {} },
      size: 10,
    })
    response = await proxyFetch(
      searchUrl,
      { method: "POST", headers, body },
      useProxy,
    )
  } else if (engine === "vectara") {
    // Vectara: POST with a minimal query
    let queryBody
    try {
      queryBody = config.queryParams
        ? JSON.parse(config.queryParams.replace(/#\$query##/g, "test"))
        : { query: [{ query: "test", numResults: 10, corpusKey: [] }] }
    } catch {
      queryBody = { query: [{ query: "test", numResults: 10, corpusKey: [] }] }
    }
    response = await proxyFetch(
      searchUrl,
      { method: "POST", headers, body: JSON.stringify(queryBody) },
      useProxy,
    )
  } else if (engine === "algolia") {
    // Algolia: POST with a minimal query
    const body = JSON.stringify({ query: "test", hitsPerPage: 10 })
    response = await proxyFetch(
      searchUrl,
      { method: "POST", headers, body },
      useProxy,
    )
  } else if (engine === "searchapi") {
    // SearchAPI: uses mapper code — need a test query
    const testQuery = config.testQuery || "test"
    let url = searchUrl
    let fetchOpts = { headers }

    if (config.apiMethod === "GET" || config.apiMethod === "JSONP") {
      // For GET, append query params — omit Content-Type (invalid on GET)
      const { "Content-Type": _, ...getHeaders } = headers
      fetchOpts = { headers: getHeaders }
      const qp = (config.queryParams || "q=#$query##").replace(
        /#\$query##/g,
        encodeURIComponent(testQuery),
      )
      url = searchUrl + (searchUrl.includes("?") ? "&" : "?") + qp
    } else {
      // For POST, substitute in body
      let body = config.queryParams || '{"query": "#$query##"}'
      body = body.replace(/#\$query##/g, testQuery)
      fetchOpts = { ...fetchOpts, method: "POST", body }
    }

    response = await proxyFetch(url, fetchOpts, useProxy)
  } else if (engine === "static") {
    // Static engine doesn't need URL validation — fields come from CSV
    return { fields: [], idFields: [] }
  } else {
    throw new Error(`Unsupported search engine: ${engine}`)
  }

  if (!response.ok) {
    throw new Error(`Search endpoint returned ${response.status} ${response.statusText}`)
  }

  const data = await response.json()

  // Extract docs from the response depending on engine
  let docs = []
  if (engine === "solr") {
    docs = (data.response && data.response.docs) || []
  } else if (engine === "es" || engine === "os") {
    docs = (data.hits && data.hits.hits) || []
  } else if (engine === "vectara") {
    // Vectara nests results under responseSet[0].response
    const responseSet = data.responseSet || data.response_set || []
    if (responseSet.length > 0) {
      docs = responseSet[0].response || responseSet[0].document || []
    }
  } else if (engine === "algolia") {
    docs = data.hits || []
  } else if (engine === "searchapi") {
    // SearchAPI: run mapper code to extract docs
    if (config.mapperCode) {
      try {
        const fn = new Function(          config.mapperCode +
            "\nreturn { numberOfResultsMapper, docsMapper };",
        )
        const mappers = fn()
        docs = mappers.docsMapper(data)
      } catch (mapErr) {
        throw new Error("Mapper code error: " + mapErr.message, { cause: mapErr })
      }
    } else {
      // No mapper — try to use the raw response as an array
      docs = Array.isArray(data) ? data : []
    }
  }

  if (docs.length === 0) {
    throw new Error("No documents returned — check your endpoint URL and query parameters.")
  }

  // Discover fields by iterating through documents
  const allFields = []
  let candidateIds = null

  for (const doc of docs) {
    const src = sourceDoc(doc, engine)
    const attributes = Object.keys(src)

    // Union — collect all unique field names
    for (const attr of attributes) {
      if (!allFields.includes(attr)) {
        allFields.push(attr)
      }
    }

    // Intersection — only keep fields present in every document
    if (candidateIds === null) {
      candidateIds = [...attributes]
    } else {
      candidateIds = candidateIds.filter((f) => attributes.includes(f))
    }
  }

  // ES/OS: prepend _id
  if (engine === "es" || engine === "os") {
    allFields.unshift("_id")
    if (candidateIds) candidateIds.unshift("_id")
  }

  return {
    fields: allFields,
    idFields: candidateIds || [],
  }
}

// Validate that custom headers is valid JSON (string or object).
export function validateHeaders(headers) {
  if (!headers) return true
  // Already a parsed object — valid
  if (typeof headers === "object") return true
  if (typeof headers !== "string" || headers.trim().length === 0) return true
  try {
    JSON.parse(headers)
    return true
  } catch {
    return false
  }
}

// Check if proxy + JSONP are combined (invalid)
export function isInvalidProxyApiMethod(proxyRequests, apiMethod) {
  return proxyRequests === true && apiMethod === "JSONP"
}

// Validate SearchAPI mapper code — check that required functions exist
export function validateMapperCode(mapperCode) {
  if (!mapperCode || mapperCode.trim().length === 0) {
    return { valid: false, error: "Mapper code is required for Search API endpoints." }
  }
  try {
    // Wrap in an IIFE with local vars to avoid polluting global scope.
    // The mapper code uses implicit global assignment (no var/let/const),
    // so we pre-declare the expected names as local vars.
    const fn = new Function(      "var numberOfResultsMapper, docsMapper;\n" +
        mapperCode +
        "\nreturn { numberOfResultsMapper: numberOfResultsMapper, docsMapper: docsMapper };",
    )
    const mappers = fn()
    if (typeof mappers.numberOfResultsMapper !== "function") {
      return { valid: false, error: "Mapper code must define numberOfResultsMapper function." }
    }
    if (typeof mappers.docsMapper !== "function") {
      return { valid: false, error: "Mapper code must define docsMapper function." }
    }
    return { valid: true, error: null }
  } catch (err) {
    return { valid: false, error: "Mapper code error: " + err.message }
  }
}
