export function engineDisplayName({ searchEngine, mapperBasedSearchEngineName } = {}) {
  if (searchEngine === "solr") return "Solr"
  return mapperBasedSearchEngineName || "Search API"
}

function shellQuoteSingle(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`
}

function encodeQueryString(url) {
  try {
    const parsed = new URL(url)
    parsed.search = parsed.searchParams.toString()
    return parsed.toString()
  } catch (error) {
    return url
  }
}

export function buildBrowseCurlCommand({ url, headers = {} } = {}) {
  const continuation = " " + "\\" + "\n"
  const lines = [`curl ${shellQuoteSingle(encodeQueryString(url))}`, continuation + " -X GET"]
  Object.entries(headers || {}).forEach(([name, value]) => {
    lines.push(`${continuation} -H '${name}: ${String(value).replace(/([\\'])/g, "\\$1")}'`)
  })
  return lines.join("")
}

export function parseBrowseHeaders(customHeaders, basicAuthCredential) {
  let headers = {}

  if (customHeaders) {
    try {
      headers = typeof customHeaders === "string" ? JSON.parse(customHeaders) : customHeaders
    } catch (error) {
      headers = {}
    }
  }

  if (!headers || typeof headers !== "object" || Array.isArray(headers)) headers = {}
  else headers = { ...headers }

  if (basicAuthCredential) headers.Authorization = `Basic ${window.btoa(basicAuthCredential)}`
  return headers
}
