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

async function executeSolrSearch(tryConfig, queryText, signal) {
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

  const baseUrl = tryConfig.search_url + "?" + formatSolrArgs(args)
  const qOption = tryConfig.options || {}
  const callUrl = hydrate(baseUrl, queryText, { qOption, encodeURI: true, defaultKw: '""' })

  const fetchUrl = tryConfig.proxy_requests !== false ? buildProxyUrl(callUrl) : callUrl
  const headers = tryConfig.proxy_requests !== false ? buildHeaders(tryConfig) : {}

  const response = await fetch(fetchUrl, { headers, signal })
  if (!response.ok) {
    throw new Error(`Solr request failed (${response.status} ${response.statusText})`)
  }
  const data = await response.json()

  const docs = (data.response && data.response.docs) || []
  const numFound = (data.response && data.response.numFound) || 0

  return {
    docs: docs.map((doc) => normalizeDoc(doc, fieldSpec, "solr")),
    numFound,
    linkUrl: callUrl + "&indent=true",
    error: data.error ? data.error.msg : null,
  }
}

// ── ES / OpenSearch search ───────────────────────────────────────────

async function executeEsSearch(tryConfig, queryText, signal) {
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

  // Paging
  const pagerArgs = queryDsl.pager || {}
  delete queryDsl.pager
  queryDsl.from = pagerArgs.from || 0
  queryDsl.size = pagerArgs.size || tryConfig.number_of_rows || 10

  const searchUrl = tryConfig.search_url
  const fetchUrl = tryConfig.proxy_requests !== false ? buildProxyUrl(searchUrl) : searchUrl
  const headers = buildHeaders(tryConfig)

  const response = await fetch(fetchUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(queryDsl),
    signal,
  })
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

  return {
    docs: hits.map((hit) => normalizeDoc(hit, fieldSpec, "es")),
    numFound,
    linkUrl: searchUrl,
    error: null,
  }
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

export async function executeSearch(tryConfig, queryText, signal) {
  const engine = (tryConfig.search_engine || "solr").toLowerCase()

  switch (engine) {
    case "solr":
    case "static":
      return executeSolrSearch(tryConfig, queryText, signal)
    case "es":
    case "os":
      return executeEsSearch(tryConfig, queryText, signal)
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
