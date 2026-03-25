import { describe, it, expect, vi, afterEach } from "vitest"
import {
  validateEndpoint,
  validateHeaders,
  isInvalidProxyApiMethod,
  validateMapperCode,
} from "modules/settings_validator"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("validateHeaders", () => {
  it("returns true for falsy input", () => {
    expect(validateHeaders(null)).toBe(true)
    expect(validateHeaders(undefined)).toBe(true)
    expect(validateHeaders("")).toBe(true)
  })

  it("returns true for an object", () => {
    expect(validateHeaders({ "x-api-key": "abc" })).toBe(true)
  })

  it("returns true for valid JSON string", () => {
    expect(validateHeaders('{"x-api-key":"abc"}')).toBe(true)
  })

  it("returns false for invalid JSON string", () => {
    expect(validateHeaders("{not json}")).toBe(false)
  })
})

describe("isInvalidProxyApiMethod", () => {
  it("returns true when proxy + JSONP", () => {
    expect(isInvalidProxyApiMethod(true, "JSONP")).toBe(true)
  })

  it("returns false for other combos", () => {
    expect(isInvalidProxyApiMethod(true, "POST")).toBe(false)
    expect(isInvalidProxyApiMethod(false, "JSONP")).toBe(false)
    expect(isInvalidProxyApiMethod(false, "GET")).toBe(false)
  })
})

describe("validateMapperCode", () => {
  const validMapper = [
    "numberOfResultsMapper = function(data) { return data.length; };",
    "docsMapper = function(data) { return data; };",
  ].join("\n")

  it("returns valid for correct mapper code", () => {
    const result = validateMapperCode(validMapper)
    expect(result.valid).toBe(true)
    expect(result.error).toBeNull()
  })

  it("returns invalid for empty input", () => {
    expect(validateMapperCode("")).toEqual({
      valid: false,
      error: "Mapper code is required for Search API endpoints.",
    })
    expect(validateMapperCode(null)).toEqual({
      valid: false,
      error: "Mapper code is required for Search API endpoints.",
    })
  })

  it("returns invalid when numberOfResultsMapper is not a function", () => {
    const result = validateMapperCode(
      'docsMapper = function(data) { return data; };\nnumberOfResultsMapper = "not a function";',
    )
    expect(result.valid).toBe(false)
    expect(result.error).toContain("numberOfResultsMapper")
  })

  it("returns invalid when docsMapper is missing", () => {
    const result = validateMapperCode(
      "numberOfResultsMapper = function(data) { return data.length; };",
    )
    expect(result.valid).toBe(false)
    expect(result.error).toContain("docsMapper")
  })

  it("returns invalid for syntax errors", () => {
    const result = validateMapperCode("this is not valid javascript {{{")
    expect(result.valid).toBe(false)
    expect(result.error).toContain("Mapper code error")
  })
})

describe("validateEndpoint", () => {
  function mockFetch(responseData, options = {}) {
    return vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: options.ok !== undefined ? options.ok : true,
      status: options.status || 200,
      statusText: options.statusText || "OK",
      json: () => Promise.resolve(responseData),
    })
  }

  it("returns fields for Solr engine", async () => {
    const fetchSpy = mockFetch({
      response: {
        docs: [
          { id: "1", title: "Doc 1", author: "A" },
          { id: "2", title: "Doc 2", author: "B" },
        ],
      },
    })

    const result = await validateEndpoint({
      searchEngine: "solr",
      searchUrl: "http://localhost:8983/solr/test/select",
    })

    expect(result.fields).toContain("id")
    expect(result.fields).toContain("title")
    expect(result.fields).toContain("author")
    expect(result.idFields).toContain("id")

    const url = fetchSpy.mock.calls[0][0]
    // URL is proxy-wrapped by default (proxyRequests !== false)
    expect(url).toContain("proxy/fetch")
    expect(url).toContain(encodeURIComponent("q=*%3A*"))
  })

  it("returns fields for ES engine with _id prepended", async () => {
    mockFetch({
      hits: {
        hits: [
          { _id: "1", _source: { title: "Doc 1", year: 2020 } },
          { _id: "2", _source: { title: "Doc 2", year: 2021 } },
        ],
      },
    })

    const result = await validateEndpoint({
      searchEngine: "es",
      searchUrl: "http://localhost:9200/test/_search",
    })

    expect(result.fields[0]).toBe("_id")
    expect(result.fields).toContain("title")
    expect(result.idFields[0]).toBe("_id")

    const [, init] = globalThis.fetch.mock.calls[0]
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body)).toEqual({ query: { match_all: {} }, size: 10 })
  })

  it("returns fields for Algolia engine", async () => {
    mockFetch({
      hits: [
        { objectID: "1", title: "Movie 1" },
        { objectID: "2", title: "Movie 2" },
      ],
    })

    const result = await validateEndpoint({
      searchEngine: "algolia",
      searchUrl: "https://example.algolia.net/1/indexes/test/query",
    })

    expect(result.fields).toContain("objectID")
    expect(result.fields).toContain("title")
  })

  it("returns empty fields for static engine without fetching", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    const result = await validateEndpoint({ searchEngine: "static" })

    expect(result).toEqual({ fields: [], idFields: [] })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("throws on unsupported engine", async () => {
    await expect(validateEndpoint({ searchEngine: "unknown" })).rejects.toThrow(
      "Unsupported search engine",
    )
  })

  it("throws on HTTP error", async () => {
    mockFetch({}, { ok: false, status: 500, statusText: "Internal Server Error" })

    await expect(
      validateEndpoint({
        searchEngine: "solr",
        searchUrl: "http://localhost:8983/solr/test/select",
      }),
    ).rejects.toThrow("500")
  })

  it("throws when no documents returned", async () => {
    mockFetch({ response: { docs: [] } })

    await expect(
      validateEndpoint({
        searchEngine: "solr",
        searchUrl: "http://localhost:8983/solr/test/select",
      }),
    ).rejects.toThrow("No documents returned")
  })

  it("uses mapper code for searchapi engine", async () => {
    const mapperCode = [
      "numberOfResultsMapper = function(data) { return data.results.length; };",
      "docsMapper = function(data) { return data.results; };",
    ].join("\n")

    mockFetch({
      results: [
        { id: "1", name: "Result 1" },
        { id: "2", name: "Result 2" },
      ],
    })

    const result = await validateEndpoint({
      searchEngine: "searchapi",
      searchUrl: "https://api.example.com/search",
      apiMethod: "POST",
      mapperCode,
    })

    expect(result.fields).toContain("id")
    expect(result.fields).toContain("name")
  })

  it("falls back to proxy on CORS error", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            response: { docs: [{ id: "1", title: "Doc" }] },
          }),
      })

    const result = await validateEndpoint({
      searchEngine: "solr",
      searchUrl: "http://remote.example.com/solr/test/select",
      proxyRequests: false,
    })

    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(fetchSpy.mock.calls[1][0]).toContain("proxy/fetch")
    expect(result.fields).toContain("id")
  })

  it("computes field intersection across docs (idFields)", async () => {
    mockFetch({
      response: {
        docs: [
          { id: "1", title: "A", extra: "x" },
          { id: "2", title: "B" },
        ],
      },
    })

    const result = await validateEndpoint({
      searchEngine: "solr",
      searchUrl: "http://localhost:8983/solr/test/select",
    })

    // Union
    expect(result.fields).toContain("extra")
    // Intersection — "extra" only in first doc
    expect(result.idFields).not.toContain("extra")
    expect(result.idFields).toContain("id")
    expect(result.idFields).toContain("title")
  })

  it("includes basic auth header when configured", async () => {
    const fetchSpy = mockFetch({
      response: { docs: [{ id: "1" }] },
    })

    await validateEndpoint({
      searchEngine: "solr",
      searchUrl: "http://localhost:8983/solr/test/select",
      basicAuthCredential: "user:pass",
      proxyRequests: true,
    })

    const headers = fetchSpy.mock.calls[0][1].headers
    expect(headers["Authorization"]).toBe("Basic " + btoa("user:pass"))
  })
})
