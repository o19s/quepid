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
    lines.push(`${continuation} -H ${shellQuoteSingle(`${name}: ${value}`)}`)
  })
  return lines.join("")
}
