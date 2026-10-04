import { afterEach, describe, expect, it, vi } from "vitest"
import { createMapperSearchRuntime } from "utils/mapper_search_runtime"

const response = data => ({ text: async function () { return JSON.stringify(await this.json()) || "" },  ok: true, status: 200, json: vi.fn(async () => data) })

describe("mapper search runtime", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("loads and maps mapper-based search engines", async () => {
    const request = vi.fn().mockResolvedValue(response({
      mapper_based_search_engines: [{
        id: 8,
        name: "Custom JSON",
        logo: "custom.svg",
        search_engine: "custom",
        api_method: "POST",
        proxy_requests: true,
        supports_basic_auth: true,
        supports_pagination: true,
        pagination_hits_param: "hits",
        pagination_offset_param: "offset",
        search_url: "https://search.example.test",
        url_format: "json",
        query_params: { query: "q" },
        bare_query_param: "query",
        mapper_code: "return data",
        custom_headers: { "X-Test": "yes" },
        header_type: "json",
        field_spec: { id: "id" },
        id_field: "id",
        title_field: "title",
        test_query: "books",
        additional_fields: []
      }]
    }))
    vi.stubGlobal("fetch", request)
    const runtime = createMapperSearchRuntime()

    const engines = await runtime.list()

    expect(request).toHaveBeenCalledWith("api/mapper_based_search_engines", { method: "GET", headers: { Accept: "application/json", "X-CSRF-Token": "" } })
    expect(engines[0]).toMatchObject({
      id: 8,
      name: "Custom JSON",
      searchEngine: "custom",
      apiMethod: "POST",
      supportsBasicAuth: true,
      paginationHitsParam: "hits",
      queryParams: { query: "q" },
      mapperCode: "return data"
    })
    expect(runtime.all()).toEqual(engines)
  })

  it("surfaces failed API responses", async () => {
    const request = vi.fn().mockResolvedValue({ text: async () => "", json: async () => null,  ok: false, status: 500 })
    vi.stubGlobal("fetch", request)
    const runtime = createMapperSearchRuntime()

    await expect(runtime.list()).rejects.toThrow("Request failed (500)")
  })
})
