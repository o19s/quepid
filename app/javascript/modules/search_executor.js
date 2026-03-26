// Search execution module — browser-side search for all Quepid search_endpoint engines,
// optionally proxied through /proxy/fetch for CORS.
//
// Behavior is aligned with splainer-search (o19s/splainer-search) factories for Solr, ES/OS,
// Vectara, Algolia, and SearchAPI; see executeSearch() dispatch. JSONP-only Solr setups are
// not reproduced here (use POST/GET + proxy or CORS-capable Solr).

import { hydrate } from "modules/query_template"
import { apiUrl } from "modules/api_url"
import { createFieldSpec } from "splainer-search"

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

// parseFieldSpec delegates to splainer-search's createFieldSpec.
// The returned FieldSpec object has: .id, .title, .thumb, .image, .fields (array),
// .subs (array or '*'), .embeds (array), .translations (array), .highlights (array),
// .functions (array), .fieldList() method, .forEachField() method.
function parseFieldSpec(fieldSpecStr) {
  return createFieldSpec(fieldSpecStr)
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
  if (options.offset) {
    args.start = [String(options.offset)]
  }
  const fl = fieldSpec.fieldList()
  if (fl === "*") {
    args.fl = ["*"]
  } else if (fl.length > 0) {
    args.fl = [fl.join(" ")]
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

  if (!tryConfig.search_url) {
    throw new Error("No search URL configured — check your try settings.")
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
    // Exact Solr GET URL after template hydration (splainer-style renderTemplate parity)
    renderedTemplate: callUrl,
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

// Escape backslashes and double-quotes so queryText can be embedded in JSON template strings.
function escapeQueryForJson(queryText) {
  if (typeof queryText !== "string") return queryText
  return queryText.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

// ── ES / OpenSearch search ───────────────────────────────────────────

async function executeEsSearch(tryConfig, queryText, signal, options = {}) {
  const fieldSpec = parseFieldSpec(tryConfig.field_spec)
  let queryDsl = structuredClone(tryConfig.args || {})

  const escapedQuery = escapeQueryForJson(queryText)

  const qOption = tryConfig.options || {}
  queryDsl = hydrate(queryDsl, escapedQuery, { qOption, encodeURI: false, defaultKw: '\\"\\"' })

  // Inject _source fields
  const esFieldList = fieldSpec.fieldList()
  if (esFieldList === "*") {
    queryDsl._source = true
  } else if (esFieldList.length > 0) {
    queryDsl._source = esFieldList
  }

  // Debug/explain mode — request explain from ES/OS
  if (options.debug) {
    queryDsl.explain = true
  }

  // Paging
  const pagerArgs = queryDsl.pager || {}
  delete queryDsl.pager
  queryDsl.from = options.offset || pagerArgs.from || 0
  queryDsl.size = pagerArgs.size || tryConfig.number_of_rows || 10

  const searchUrl = tryConfig.search_url

  // Pretty JSON of the hydrated body actually POSTed (template tab / renderTemplate parity)
  const renderedTemplate = JSON.stringify(queryDsl, null, 2)

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
      renderedTemplate,
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
    renderedTemplate,
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

// ── Vectara (POST JSON; splainer: vectaraSearcherFactory) ─────────────

function applyVectaraPaging(queryDsl, offset, pageSize) {
  const q = structuredClone(queryDsl)
  const size = pageSize ?? q.query?.[0]?.numResults ?? 10
  const start = offset ?? 0
  if (Array.isArray(q.query) && q.query[0] && typeof q.query[0] === "object") {
    q.query[0].start = start
    q.query[0].numResults = size
  }
  return q
}

async function executeVectaraSearch(tryConfig, queryText, signal, options = {}) {
  const fieldSpec = parseFieldSpec(tryConfig.field_spec)
  let queryDsl = structuredClone(tryConfig.args || {})

  const escapedQuery = escapeQueryForJson(queryText)

  const qOption = tryConfig.options || {}
  queryDsl = hydrate(queryDsl, escapedQuery, { qOption, encodeURI: false, defaultKw: '\\"\\"' })

  const pageSize = tryConfig.number_of_rows || queryDsl.query?.[0]?.numResults || 10
  queryDsl = applyVectaraPaging(queryDsl, options.offset || 0, pageSize)

  const searchUrl = tryConfig.search_url
  const renderedTemplate = JSON.stringify(queryDsl, null, 2)

  const response = await fetchWithCorsFallback(
    searchUrl,
    {
      method: "POST",
      headers: buildHeaders(tryConfig),
      body: JSON.stringify(queryDsl),
      signal,
    },
    tryConfig,
  )
  if (!response.ok) {
    throw new Error(`Vectara request failed (${response.status} ${response.statusText})`)
  }
  const data = await response.json()

  const responseSet = data.responseSet && data.responseSet.length > 0 ? data.responseSet[0] : {}
  const documents = responseSet.document || []
  const numFound =
    typeof responseSet.resultLength === "number" ? responseSet.resultLength : documents.length

  const normalizedDocs = documents.map((doc) => normalizeDoc(doc, fieldSpec, "vectara"))

  return {
    docs: normalizedDocs,
    numFound,
    linkUrl: searchUrl,
    renderedTemplate,
    error: data.message || data.error || null,
    ...(options.debug ? { queryDetails: queryDsl, parsedQueryDetails: null } : {}),
  }
}

// ── Algolia (POST; splainer: algoliaSearchFactory) ────────────────────

async function executeAlgoliaSearch(tryConfig, queryText, signal, options = {}) {
  const fieldSpec = parseFieldSpec(tryConfig.field_spec)
  let queryDsl = structuredClone(tryConfig.args || {})

  const escapedQuery = escapeQueryForJson(queryText)

  const qOption = tryConfig.options || {}
  queryDsl = hydrate(queryDsl, escapedQuery, { qOption, encodeURI: false, defaultKw: '\\"\\"' })

  const pageSize = queryDsl.hitsPerPage || tryConfig.number_of_rows || 10
  if (options.offset) {
    queryDsl.page = Math.floor(options.offset / pageSize)
  }

  const searchUrl = tryConfig.search_url
  const renderedTemplate = JSON.stringify(queryDsl, null, 2)

  const response = await fetchWithCorsFallback(
    searchUrl,
    {
      method: "POST",
      headers: buildHeaders(tryConfig),
      body: JSON.stringify(queryDsl),
      signal,
    },
    tryConfig,
  )
  if (!response.ok) {
    throw new Error(`Algolia request failed (${response.status} ${response.statusText})`)
  }
  const data = await response.json()

  const hits = data.hits || []
  const numFound = typeof data.nbHits === "number" ? data.nbHits : hits.length

  const normalizedDocs = hits.map((hit) => {
    const flat = { ...hit, id: hit.objectID, objectID: hit.objectID }
    return normalizeDoc(flat, fieldSpec, "algolia")
  })

  return {
    docs: normalizedDocs,
    numFound,
    linkUrl: searchUrl,
    renderedTemplate,
    error: data.message || null,
    ...(options.debug ? { queryDetails: queryDsl, parsedQueryDetails: null } : {}),
  }
}

// ── SearchAPI (GET or POST + user mappers; splainer: searchApiSearcherFactory) ──
//
// SECURITY NOTE: compileSearchApiMappers uses `new Function()` to execute user-provided
// mapper_code. This mirrors the splainer-search approach. mapper_code is stored per-try
// and is only editable by users who own the case — treat it as trusted, same-origin script.

function compileSearchApiMappers(mapperCode) {
  if (!mapperCode || !String(mapperCode).trim()) {
    throw new Error("SearchAPI requires mapper_code with numberOfResultsMapper and docsMapper")
  }
  try {
    const factory = new Function(
      `${mapperCode}\nreturn {\n  numberOfResultsMapper: typeof numberOfResultsMapper !== "undefined" ? numberOfResultsMapper : null,\n  docsMapper: typeof docsMapper !== "undefined" ? docsMapper : null,\n};`,
    )
    const m = factory()
    if (typeof m.numberOfResultsMapper !== "function" || typeof m.docsMapper !== "function") {
      throw new Error("mapper_code must define numberOfResultsMapper and docsMapper functions")
    }
    return m
  } catch (e) {
    throw new Error(`SearchAPI mapper_code failed: ${e.message}`, { cause: e })
  }
}

function appendSearchApiGetParams(baseUrl, queryDsl) {
  const params = []
  if (queryDsl && typeof queryDsl === "object" && !Array.isArray(queryDsl)) {
    for (const [key, value] of Object.entries(queryDsl)) {
      params.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    }
  } else if (queryDsl != null && queryDsl !== "") {
    params.push(String(queryDsl))
  }
  const join = params.join("&")
  if (!join) return baseUrl
  const hasQuery = baseUrl.includes("?")
  const endsWithQ = baseUrl.endsWith("?")
  const sep = hasQuery ? (endsWithQ ? "" : "&") : "?"
  return baseUrl + sep + join
}

async function executeSearchApiSearch(tryConfig, queryText, signal, options = {}) {
  const fieldSpec = parseFieldSpec(tryConfig.field_spec)
  const mappers = compileSearchApiMappers(tryConfig.mapper_code)

  const escapedQuery = escapeQueryForJson(queryText)

  const qOption = tryConfig.options || {}
  let queryDsl = hydrate(structuredClone(tryConfig.args || {}), escapedQuery, {
    qOption,
    encodeURI: false,
    defaultKw: '\\"\\"',
  })

  const apiMethod = (tryConfig.api_method || "POST").toUpperCase()
  let requestUrl = tryConfig.search_url
  let renderedTemplate
  let response

  if (apiMethod === "GET") {
    requestUrl = appendSearchApiGetParams(requestUrl, queryDsl)
    renderedTemplate = requestUrl
    response = await fetchWithCorsFallback(requestUrl, { method: "GET", signal }, tryConfig)
  } else {
    renderedTemplate = JSON.stringify(queryDsl, null, 2)
    response = await fetchWithCorsFallback(
      tryConfig.search_url,
      {
        method: "POST",
        headers: buildHeaders(tryConfig),
        body: JSON.stringify(queryDsl),
        signal,
      },
      tryConfig,
    )
  }

  if (!response.ok) {
    throw new Error(`SearchAPI request failed (${response.status} ${response.statusText})`)
  }
  // SearchAPI mapper_code may expect any format (HTML, XML, plain text, or JSON),
  // so read the body as text first and attempt JSON parse only if applicable.
  const rawText = await response.text()
  let data
  try {
    data = JSON.parse(rawText)
  } catch {
    // Not JSON — pass raw text to mapper functions (e.g., HTML scraping mappers)
    data = rawText
  }

  const mapperError = (msg) => ({
    docs: [],
    numFound: 0,
    linkUrl: requestUrl,
    renderedTemplate,
    error: msg,
  })

  let numFound
  try {
    numFound = mappers.numberOfResultsMapper(data)
  } catch (e) {
    return mapperError(`numberOfResultsMapper failed: ${e.message}`)
  }

  let mappedDocs
  try {
    mappedDocs = mappers.docsMapper(data)
  } catch (e) {
    return mapperError(`docsMapper failed: ${e.message}`)
  }

  if (!Array.isArray(mappedDocs)) {
    return mapperError("docsMapper must return an array of documents")
  }

  const maxRows = tryConfig.number_of_rows || 10
  if (mappedDocs.length > maxRows) {
    mappedDocs = mappedDocs.slice(0, maxRows)
  }

  const normalizedDocs = mappedDocs.map((doc) => normalizeDoc(doc, fieldSpec, "searchapi"))

  return {
    docs: normalizedDocs,
    numFound,
    linkUrl: requestUrl,
    renderedTemplate,
    error: null,
    ...(options.debug ? { queryDetails: queryDsl, parsedQueryDetails: null } : {}),
  }
}

// ── Normalize a doc for display ──────────────────────────────────────

function normalizeDoc(rawDoc, fieldSpec, engine) {
  let source, id

  if (engine === "solr") {
    source = rawDoc
    id = rawDoc[fieldSpec.id || "id"] || rawDoc.id || ""
  } else if (engine === "vectara") {
    const meta = {}
    for (const item of rawDoc.metadata || []) {
      if (!item || item.name == null) continue
      const v = item.value
      meta[item.name] = Array.isArray(v) && v.length === 1 ? v[0] : v
    }
    source = { ...meta }
    if (rawDoc.document_id != null) source.document_id = rawDoc.document_id
    if (rawDoc.title != null) source.title = rawDoc.title
    id =
      String(
        rawDoc.document_id ??
          meta[fieldSpec.id || "id"] ??
          meta.id ??
          rawDoc.id ??
          source.title ??
          "",
      ) || ""
  } else if (engine === "algolia" || engine === "searchapi") {
    source = { ...rawDoc }
    delete source.opts
    id = String(
      rawDoc.objectID ??
        rawDoc.id ??
        (fieldSpec.id ? rawDoc[fieldSpec.id] : null) ??
        rawDoc.document_id ??
        "",
    )
  } else {
    // ES / OS
    source = rawDoc._source || {}
    id = rawDoc._id || source[fieldSpec.id] || ""
  }

  const title = source[fieldSpec.title] || id
  const subs = {}
  if (fieldSpec.subs === "*") {
    // Wildcard: include all source fields except id, title, thumb, image
    const excluded = new Set([fieldSpec.id, fieldSpec.title, fieldSpec.thumb, fieldSpec.image].filter(Boolean))
    for (const key of Object.keys(source)) {
      if (!excluded.has(key)) {
        subs[key] = source[key]
      }
    }
  } else {
    for (const sub of fieldSpec.subs || []) {
      if (source[sub] !== undefined) {
        subs[sub] = source[sub]
      }
    }
  }

  let thumb = null
  if (fieldSpec.thumb && source[fieldSpec.thumb]) {
    thumb = source[fieldSpec.thumb]
  }

  // Media embeds (media:fieldname in field_spec → fieldSpec.embeds)
  const embeds = {}
  for (const mediaField of fieldSpec.embeds || []) {
    if (source[mediaField] !== undefined) {
      embeds[mediaField] = source[mediaField]
    }
  }

  // Translation fields (translate:fieldname in field_spec)
  const translations = {}
  for (const transField of fieldSpec.translations || []) {
    if (source[transField] !== undefined) {
      translations[transField] = source[transField]
    }
  }

  return { id, title, subs, thumb, embeds, translations, _source: source }
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
    case "vectara":
      return executeVectaraSearch(tryConfig, queryText, signal, options)
    case "algolia":
      return executeAlgoliaSearch(tryConfig, queryText, signal, options)
    case "searchapi":
      return executeSearchApiSearch(tryConfig, queryText, signal, options)
    default:
      return {
        docs: [],
        numFound: 0,
        linkUrl: "",
        renderedTemplate: null,
        error: `Search engine "${engine}" is not supported`,
      }
  }
}

export { parseFieldSpec }
