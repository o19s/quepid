// Search execution module — sends queries to Solr/ES/OS from the browser,
// optionally proxied through /proxy/fetch for CORS.

import { hydrate } from "modules/query_template"
import { apiUrl } from "modules/api_url"

// Format Solr args object {q: ["*:*"], fq: ["a:1","b:2"]} into URL query string
function formatSolrArgs(argsObj) {
  let result = ""
  for (const [param, values] of Object.entries(argsObj)) {
    if (typeof values === "string") {
      result += param + "=" + values + "&"
    } else if (Array.isArray(values)) {
      for (const value of values) {
        result += param + "=" + value + "&"
      }
    }
  }
  // Escape bare % characters (not already part of percent-encoding)
  result = result.replace(/%(?![0-9A-Fa-f]{2})/g, "%25")
  return result.slice(0, -1)
}

function buildProxyUrl(targetUrl) {
  return apiUrl(`proxy/fetch?url=${encodeURIComponent(targetUrl)}`)
}

// Attempt a direct fetch; if it fails with a network/CORS error, retry via proxy.
// This preserves DevTools observability when direct access works (e.g., localhost Solr)
// while falling back to the proxy for cross-origin servers without CORS headers.
async function fetchWithCorsFallback(directUrl, fetchOptions, tryConfig) {
  const useProxy = tryConfig.proxy_requests !== false
  if (useProxy) {
    return fetch(buildProxyUrl(directUrl), {
      ...fetchOptions,
      headers: { ...buildHeaders(tryConfig), ...fetchOptions.headers },
    })
  }

  // Direct mode: try fetch, fall back to proxy on network/CORS failure
  try {
    return await fetch(directUrl, fetchOptions)
  } catch (err) {
    // TypeError is thrown for network errors (CORS blocked, DNS failure, etc.)
    if (err instanceof TypeError) {
      // Retry through the proxy — don't forward Content-Type or custom headers
      // on GET requests; the proxy controller handles headers for the upstream call.
      const proxyHeaders = {}
      if (fetchOptions.method && fetchOptions.method !== "GET") {
        Object.assign(proxyHeaders, buildHeaders(tryConfig), fetchOptions.headers)
      }
      return fetch(buildProxyUrl(directUrl), {
        ...fetchOptions,
        headers: proxyHeaders,
      })
    }
    throw err
  }
}

function parseFieldSpec(fieldSpecStr) {
  if (!fieldSpecStr) return { title: null, id: null, fields: [] }

  const specs = fieldSpecStr.split(/[\s,+]+/).filter(Boolean)
  const result = { title: null, id: null, fields: [], subs: [] }

  for (const spec of specs) {
    const parts = spec.split(":")
    if (parts.length === 1) {
      const name = parts[0]
      result.fields.push(name)
      if (!result.title) {
        result.title = name
      } else {
        result.subs.push(name)
      }
    } else {
      const fieldName = parts.pop()
      const types = parts
      result.fields.push(fieldName)
      for (const type of types) {
        if (type === "id") result.id = fieldName
        else if (type === "title") result.title = fieldName
        else if (type === "sub") result.subs.push(fieldName)
        else if (type === "thumb" || type === "image" || type === "media") result.thumb = fieldName
      }
    }
  }

  // Default id fields
  if (!result.id) {
    if (result.fields.includes("id")) result.id = "id"
    else if (result.fields.includes("_id")) result.id = "_id"
  }

  return result
}

// Build headers for a proxied request, including custom headers and basic auth
function buildHeaders(tryConfig) {
  const headers = { "Content-Type": "application/json" }

  if (tryConfig.custom_headers) {
    try {
      const custom =
        typeof tryConfig.custom_headers === "string"
          ? JSON.parse(tryConfig.custom_headers)
          : tryConfig.custom_headers
      Object.assign(headers, custom)
    } catch {
      // ignore malformed custom headers
    }
  }

  if (tryConfig.basic_auth_credential) {
    headers["Authorization"] = "Basic " + btoa(tryConfig.basic_auth_credential)
  }

  return headers
}

// ── Solr search ──────────────────────────────────────────────────────

async function executeSolrSearch(tryConfig, queryText, signal, options = {}) {
  const args = structuredClone(tryConfig.args || {})
  const fieldSpec = parseFieldSpec(tryConfig.field_spec)

  // Set required Solr params
  args.wt = ["json"]
  if (!args.rows) {
    args.rows = [tryConfig.number_of_rows || 10]
  }
  if (fieldSpec.fields.length > 0) {
    args.fl = [fieldSpec.fields.join(" ")]
  }

  // Debug/explain mode — request structured explain from Solr
  if (options.debug) {
    args.debug = ["true"]
    args["debug.explain.structured"] = ["true"]
    // Ensure score pseudo-field is included in fl
    if (args.fl && args.fl[0] && !args.fl[0].includes("score")) {
      args.fl = [args.fl[0] + " score"]
    }
  }

  const baseUrl = tryConfig.search_url + "?" + formatSolrArgs(args)
  const qOption = tryConfig.options || {}
  const callUrl = hydrate(baseUrl, queryText, { qOption, encodeURI: true, defaultKw: '""' })

  const response = await fetchWithCorsFallback(callUrl, { signal }, tryConfig)
  if (!response.ok) {
    throw new Error(`Solr request failed (${response.status} ${response.statusText})`)
  }
  const data = await response.json()

  const docs = (data.response && data.response.docs) || []
  const numFound = (data.response && data.response.numFound) || 0

  // Extract per-doc explain data and query-level debug info
  const explainMap = options.debug ? (data.debug && data.debug.explain) || {} : null
  const normalizedDocs = docs.map((doc) => {
    const nDoc = normalizeDoc(doc, fieldSpec, "solr")
    if (options.debug && explainMap) {
      const docId = doc[fieldSpec.id || "id"] || doc.id || ""
      nDoc.explain = explainMap[docId] || null
      nDoc.score =
        typeof doc.score === "number" ? doc.score : parseFloat(nDoc.explain?.value) || null
    }
    return nDoc
  })

  const result = {
    docs: normalizedDocs,
    numFound,
    linkUrl: callUrl + "&indent=true",
    error: data.error ? data.error.msg : null,
  }

  if (options.debug && data.debug) {
    result.queryDetails = data.debug.querystring || null
    result.parsedQueryDetails = data.debug.parsedquery_toString
      ? {
          parsedquery: data.debug.parsedquery,
          parsedquery_toString: data.debug.parsedquery_toString,
        }
      : data.debug.parsedquery || null
    result.rawDebug = data.debug
  }

  return result
}

// ── ES / OpenSearch search ───────────────────────────────────────────

async function executeEsSearch(tryConfig, queryText, signal, options = {}) {
  const fieldSpec = parseFieldSpec(tryConfig.field_spec)
  let queryDsl = structuredClone(tryConfig.args || {})

  // Escape backslashes and quotes in query text for JSON embedding
  let escapedQuery = queryText
  if (typeof escapedQuery === "string") {
    escapedQuery = escapedQuery.replace(/\\/g, "\\\\")
    escapedQuery = escapedQuery.replace(/"/g, '\\"')
  }

  const qOption = tryConfig.options || {}
  queryDsl = hydrate(queryDsl, escapedQuery, { qOption, encodeURI: false, defaultKw: '\\"\\"' })

  // Inject _source fields
  if (fieldSpec.fields.length > 0) {
    queryDsl._source = fieldSpec.fields
  }

  // Debug/explain mode — request explain from ES/OS
  if (options.debug) {
    queryDsl.explain = true
  }

  // Paging
  const pagerArgs = queryDsl.pager || {}
  delete queryDsl.pager
  queryDsl.from = pagerArgs.from || 0
  queryDsl.size = pagerArgs.size || tryConfig.number_of_rows || 10

  const searchUrl = tryConfig.search_url

  const response = await fetchWithCorsFallback(
    searchUrl,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(queryDsl),
      signal,
    },
    tryConfig,
  )
  if (!response.ok) {
    throw new Error(`ES/OS request failed (${response.status} ${response.statusText})`)
  }
  const data = await response.json()

  if (data.error) {
    return {
      docs: [],
      numFound: 0,
      linkUrl: searchUrl,
      error: typeof data.error === "string" ? data.error : JSON.stringify(data.error),
    }
  }

  const hits = (data.hits && data.hits.hits) || []
  const total = data.hits && data.hits.total
  const numFound = typeof total === "object" ? total.value : total || 0

  const normalizedDocs = hits.map((hit) => {
    const nDoc = normalizeDoc(hit, fieldSpec, "es")
    if (options.debug) {
      // ES returns _explanation per hit when explain=true
      nDoc.explain = hit._explanation || null
      nDoc.score = typeof hit._score === "number" ? hit._score : null
    }
    return nDoc
  })

  const result = {
    docs: normalizedDocs,
    numFound,
    linkUrl: searchUrl,
    error: null,
  }

  if (options.debug) {
    // ES doesn't return queryDetails the same way as Solr;
    // we provide the query DSL that was sent as "queryDetails"
    result.queryDetails = queryDsl
    result.parsedQueryDetails = null
  }

  return result
}

// ── Normalize a doc for display ──────────────────────────────────────

function normalizeDoc(rawDoc, fieldSpec, engine) {
  let source, id

  if (engine === "solr") {
    source = rawDoc
    id = rawDoc[fieldSpec.id || "id"] || rawDoc.id || ""
  } else {
    // ES / OS
    source = rawDoc._source || {}
    id = rawDoc._id || source[fieldSpec.id] || ""
  }

  const title = source[fieldSpec.title] || id
  const subs = {}
  for (const sub of fieldSpec.subs || []) {
    if (source[sub] !== undefined) {
      subs[sub] = source[sub]
    }
  }

  let thumb = null
  if (fieldSpec.thumb && source[fieldSpec.thumb]) {
    thumb = source[fieldSpec.thumb]
  }

  return { id, title, subs, thumb, _source: source }
}

// ── Public API ───────────────────────────────────────────────────────

export async function executeSearch(tryConfig, queryText, signal, options = {}) {
  const engine = (tryConfig.search_engine || "solr").toLowerCase()

  switch (engine) {
    case "solr":
    case "static":
      return executeSolrSearch(tryConfig, queryText, signal, options)
    case "es":
    case "os":
      return executeEsSearch(tryConfig, queryText, signal, options)
    default:
      return {
        docs: [],
        numFound: 0,
        linkUrl: "",
        error: `Search engine "${engine}" is not yet supported in the new UI`,
      }
  }
}

export { parseFieldSpec }
