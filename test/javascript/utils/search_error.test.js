import { describe, expect, it } from "vitest"
import { codeToString, formatCode, parseResponseObject } from "utils/search_error"

describe("search error utilities", () => {
  it("maps known and unknown status codes", () => {
    expect(codeToString(500)).toBe("Internal Server Error")
    expect(codeToString(999)).toBe("Unknown Error")
    expect(formatCode(500)).toBe("[500: Internal Server Error]")
    expect(formatCode(0)).toBeUndefined()
  })

  it("returns the Solr-specific message with the inspection link", () => {
    const message = parseResponseObject({}, "http://example.com", "solr")

    expect(message).toContain('href="http://example.com"')
    expect(message).toContain("Solr instance directly")
  })

  it("surfaces mapper errors and generic HTTP response details", () => {
    const mapperError = new Error("MapperError: mapper failed")
    expect(parseResponseObject(mapperError, "http://example.com", "searchapi")).toBe(
      "Search API mapper error: MapperError: mapper failed"
    )

    expect(parseResponseObject({ status: 500, statusText: "Internal Server Error" }, "", "searchapi")).toContain(
      "[500: Internal Server Error] - Internal Server Error"
    )
  })

  it("handles URL/CORS errors and API response messages without undefined", () => {
    expect(parseResponseObject({ status: -1 }, "", "es")).toContain("typo in your URL")

    const message = parseResponseObject({
      status: 400,
      statusText: "Bad Request",
      data: { message: "invalid setting" }
    }, "", "algolia")
    expect(message).toContain("invalid setting")
    expect(message).not.toContain("undefined")
  })

  it("appends the engine's error body, serializing Elasticsearch-style error objects", () => {
    const esError = { type: "parsing_exception", reason: "Unknown key [qury]" }

    expect(parseResponseObject({ status: 400, data: { error: esError } }, "", "es"))
      .toMatch(/: \{"type":"parsing_exception","reason":"Unknown key \[qury\]"\}$/)
    expect(parseResponseObject({ status: 400, data: { error: "bad field" } }, "", "os"))
      .toMatch(/: bad field$/)
  })
})
