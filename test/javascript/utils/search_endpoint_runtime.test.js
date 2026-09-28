import { describe, expect, it, vi } from "vitest"
import { createSearchEndpointRuntime } from "utils/search_endpoint_runtime"

const response = data => ({ ok: true, status: 200, json: vi.fn(async () => data) })

describe("search endpoint runtime", () => {
  it("loads, maps, and deduplicates endpoints", async () => {
    const request = vi.fn().mockResolvedValue(response({
      search_endpoints: [
        {
          search_endpoint_id: 4,
          name: "Primary",
          search_engine: "solr",
          endpoint_url: "https://search.example.test",
          api_method: "GET",
          custom_headers: { Authorization: "Basic token" },
          proxy_requests: true,
          basic_auth_credential: "credential",
          mapper_code: null,
          test_query: "q=test",
          mapper_based_search_engine_id: null
        },
        { search_endpoint_id: 4, name: "Duplicate" }
      ]
    }))
    const runtime = createSearchEndpointRuntime({ request })

    const endpoints = await runtime.list()

    expect(request).toHaveBeenCalledWith("api/search_endpoints", {
      headers: { Accept: "application/json" }
    })
    expect(endpoints).toEqual([{
      id: 4,
      name: "Primary",
      searchEngine: "solr",
      endpointUrl: "https://search.example.test",
      apiMethod: "GET",
      customHeaders: { Authorization: "Basic token" },
      proxyRequests: true,
      basicAuthCredential: "credential",
      mapperCode: null,
      testQuery: "q=test",
      mapperBasedSearchEngineId: null
    }])
    expect(runtime.all()).toEqual(endpoints)
  })

  it("fetches case endpoints and exposes engine predicates", async () => {
    const request = vi.fn().mockResolvedValue(response({ search_endpoints: [] }))
    const runtime = createSearchEndpointRuntime({ request })

    await runtime.fetchForCase(12)

    expect(request).toHaveBeenCalledWith("api/cases/12/search_endpoints", {
      headers: { Accept: "application/json" }
    })
    expect(runtime.isEsOrOsEngine("es")).toBe(true)
    expect(runtime.isEsOrOsEngine("os")).toBe(true)
    expect(runtime.isEsOrOsEngine("solr")).toBe(false)
    expect(runtime.usesJsonQueryParams("vectara")).toBe(true)
    expect(runtime.usesJsonQueryParams("algolia")).toBe(true)
    expect(runtime.usesJsonQueryParams("searchapi")).toBe(false)
  })

  it("surfaces failed API responses", async () => {
    const request = vi.fn().mockResolvedValue({ ok: false, status: 503 })
    const runtime = createSearchEndpointRuntime({ request })

    await expect(runtime.list()).rejects.toThrow("Unable to load search endpoints (503)")
  })
})
