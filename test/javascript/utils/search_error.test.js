import { describe, expect, it } from "vitest"
import { SearchError, codeToString, formatCode, parseResponseObject } from "utils/search_error"

describe("search error utilities", () => {
  it("maps known and unknown status codes", () => {
    expect(codeToString(500)).toBe("Internal Server Error")
    expect(codeToString(999)).toBe("Unknown Error")
    expect(formatCode(500)).toBe("[500: Internal Server Error]")
    expect(formatCode(0)).toBeUndefined()
  })

  it("returns the Solr-specific message with structured inspection and wiki links", () => {
    const error = parseResponseObject({}, "http://example.com", "solr")

    expect(error).toBeInstanceOf(SearchError)
    expect(error.parts.filter((part) => part.href)).toEqual([
      { text: "Solr instance directly", href: "http://example.com" },
      {
        text: "on the troubleshooting Solr wiki page",
        href: "https://github.com/o19s/quepid/wiki/Troubleshooting-Solr-and-Quepid#compatibility-with-nosniff"
      }
    ])
    expect(error.message).toContain("please access Solr instance directly to confirm")
    expect(error.message).not.toContain("<a")
  })

  it("renders escaped markup with safe links for the per-query error panel", () => {
    const html = parseResponseObject({}, "http://example.com/?q=\"><img>", "solr").toHtml()
    const container = document.createElement("div")
    container.innerHTML = html

    expect(container.querySelector("img")).toBeNull()
    expect(container.querySelectorAll("a")).toHaveLength(2)
    expect(container.querySelector("a").getAttribute("href")).toBe("http://example.com/?q=%22%3E%3Cimg%3E")
  })

  it("treats server-supplied error text as text, not markup", () => {
    const error = parseResponseObject({ status: 500, data: { error: "<script>x</script>" } }, "", "es")

    expect(error.parts).toEqual([{ text: "An unexpected error was returned: [500: Internal Server Error]: <script>x</script>" }])
    expect(error.toHtml()).toContain("&lt;script&gt;")
  })

  it("surfaces mapper errors and generic HTTP response details", () => {
    const mapperError = new Error("MapperError: mapper failed")
    expect(parseResponseObject(mapperError, "http://example.com", "searchapi").message).toBe(
      "Search API mapper error: MapperError: mapper failed"
    )

    expect(parseResponseObject({ status: 500, statusText: "Internal Server Error" }, "", "searchapi").message).toContain(
      "[500: Internal Server Error] - Internal Server Error"
    )
  })

  it("handles URL/CORS errors with a wiki link and API response messages without undefined", () => {
    const urlError = parseResponseObject({ status: -1 }, "", "es")
    expect(urlError.message).toContain("typo in your URL (Quepid Wiki for more help)")
    expect(urlError.parts).toContainEqual({ text: "Quepid Wiki", href: "https://github.com/o19s/quepid/wiki" })

    const message = parseResponseObject({
      status: 400,
      statusText: "Bad Request",
      data: { message: "invalid setting" }
    }, "", "algolia").message
    expect(message).toContain("invalid setting")
    expect(message).not.toContain("undefined")
  })

  it("appends the engine's error body, serializing Elasticsearch-style error objects", () => {
    const esError = { type: "parsing_exception", reason: "Unknown key [qury]" }

    expect(parseResponseObject({ status: 400, data: { error: esError } }, "", "es").message)
      .toMatch(/: \{"type":"parsing_exception","reason":"Unknown key \[qury\]"\}$/)
    expect(parseResponseObject({ status: 400, data: { error: "bad field" } }, "", "os").message)
      .toMatch(/: bad field$/)
  })
})

describe("HTTP status names", () => {
  const names = {
  100: "Continue",
  101: "Switching Protocols",
  102: "Processing",
  200: "OK",
  201: "Created",
  202: "Accepted",
  203: "Non-Authoritative Information",
  204: "No Content",
  205: "Reset Content",
  206: "Partial Content",
  207: "Multi-Status",
  300: "Multiple Choices",
  301: "Moved Permanently",
  302: "Moved Temporarily",
  303: "See Other",
  304: "Not Modified",
  305: "Use Proxy",
  307: "Temporary Redirect",
  308: "Permanent Redirect",
  400: "Bad Request",
  401: "Unauthorized",
  402: "Payment Required",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  406: "Not Acceptable",
  407: "Proxy Authentication Required",
  408: "Request Time-out",
  409: "Conflict",
  410: "Gone",
  411: "Length Required",
  412: "Precondition Failed",
  413: "Request Entity Too Large",
  414: "Request-URI Too Large",
  415: "Unsupported Media Type",
  416: "Requested Range Not Satisfiable",
  417: "Expectation Failed",
  418: "I'm a teapot",
  422: "Unprocessable Entity",
  423: "Locked",
  424: "Failed Dependency",
  425: "Unordered Collection",
  426: "Upgrade Required",
  428: "Precondition Required",
  429: "Too Many Requests",
  431: "Request Header Fields Too Large",
  500: "Internal Server Error",
  501: "Not Implemented",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Time-out",
  505: "HTTP Version Not Supported",
  506: "Variant Also Negotiates",
  507: "Insufficient Storage",
  509: "Bandwidth Limit Exceeded",
  510: "Not Extended",
  511: "Network Authentication Required"
  }

  it.each(Object.entries(names))("names status %s", (code, name) => {
    expect(codeToString(Number(code))).toBe(name)
    expect(formatCode(Number(code))).toBe(`[${code}: ${name}]`)
  })

  it("does not inherit names from Object.prototype", () => {
    expect(codeToString("constructor")).toBe("Unknown Error")
  })
})

describe("parseResponseObject fallbacks", () => {
  it("labels the error with the SearchError name and joins parts into the message", () => {
    const error = parseResponseObject({ status: 500 }, "u", "es")
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe("SearchError")
    expect(error.message).toBe(error.parts.map((part) => part.text).join(""))
  })

  it("appends status text, reason and response body details in order", () => {
    const text = (response) => parseResponseObject(response, "u", "es").message
    expect(text({ status: 500 })).toBe("An unexpected error was returned: [500: Internal Server Error]")
    expect(text({ status: 500, statusText: "Boom", reason: "Why" })).toBe(
      "An unexpected error was returned: [500: Internal Server Error] - Boom - Why"
    )
    expect(text({ status: 500, reason: "Why" })).toContain("] - Why")
    expect(text({ status: 500, data: { error: { type: "x" } } })).toContain(': {"type":"x"}')
    expect(text({ status: 500, data: { error: "bad" } })).toContain(": bad")
    expect(text({ status: 500, data: { message: "msg" } })).toContain(": msg")
    expect(text({ status: 500, data: { other: 1 } })).toBe(
      "An unexpected error was returned: [500: Internal Server Error]"
    )
  })

  it("explains a status of -1 and mapper errors", () => {
    const unreachable = parseResponseObject({ status: -1 }, "u", "es")
    expect(unreachable.parts[1]).toEqual({ text: "Quepid Wiki", href: "https://github.com/o19s/quepid/wiki" })
    expect(unreachable.message).toContain("make sure that CORS is enabled")
    expect(parseResponseObject(new Error("bad mapper"), "u", "searchapi").message).toBe(
      "Search API mapper error: bad mapper"
    )
  })

  it("renders links as anchors in toHtml", () => {
    const html = parseResponseObject({ status: 1 }, "https://solr.test/select", "solr").toHtml()
    expect(html).toContain('<a href="https://solr.test/select"')
    expect(html).toContain("Solr instance directly")
  })
})

