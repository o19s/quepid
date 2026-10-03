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
