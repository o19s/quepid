import { describe, expect, it, vi } from "vitest"
import { createLiveQuerySearchRuntime } from "utils/live_query_search"

describe("live query search runtime", () => {
  it("adapts case services to the framework-free searcher boundary", () => {
    const createSearcher = vi.fn(() => ({ type: "solr" }))
    const proxyUrlFor = vi.fn(() => "https://proxy.test/search")
    const isEsOrOs = vi.fn(() => false)
    const evaluateMapper = vi.fn(() => ({}))
    const runtime = createLiveQuerySearchRuntime({
      proxyUrlFor,
      isEsOrOs,
      evaluateMapper,
      createSearcher
    })
    const settings = {
      searchEngine: "solr",
      proxyRequests: true,
      searchEndpointId: 12,
      selectedTry: {
        args: { q: "#$query##" },
        jsonQueryParams: false,
        searchUrl: "https://search.test"
      },
      createFieldSpec: () => ({ id: "id" })
    }

    const searcher = runtime.createSearcherFromSettings(settings, {
      queryText: "books",
      options: {},
      filterToRatings: vi.fn()
    })

    expect(searcher).toEqual({ type: "solr" })
    expect(proxyUrlFor).toHaveBeenCalledWith(12)
    expect(isEsOrOs).toHaveBeenCalledWith("solr")
    expect(createSearcher).toHaveBeenCalledWith(
      { id: "id" },
      "https://search.test",
      { q: "#$query##", echoParams: "all" },
      "books",
      expect.objectContaining({ proxyUrl: "https://proxy.test/search" }),
      "solr"
    )
  })

  it("keeps the missing-try contract at the runtime boundary", () => {
    const createSearcher = vi.fn()
    const runtime = createLiveQuerySearchRuntime({
      proxyUrlFor: vi.fn(),
      isEsOrOs: vi.fn(),
      evaluateMapper: vi.fn(),
      createSearcher
    })

    expect(runtime.createSearcherFromSettings({}, { queryText: "books" })).toBeUndefined()
    expect(createSearcher).not.toHaveBeenCalled()
  })

  it("preserves Search API apiMethod defaults and forced overrides", () => {
    const createSearcher = vi.fn((fieldSpec, searchUrl, args, queryText, searcherOptions) => ({
      settings: { searcherOptions }
    }))
    const runtime = createLiveQuerySearchRuntime({
      proxyUrlFor: vi.fn(),
      isEsOrOs: vi.fn(() => false),
      evaluateMapper: vi.fn(() => ({})),
      createSearcher
    })
    const settings = {
      searchEngine: "searchapi",
      apiMethod: "AUTO",
      selectedTry: { args: { yql: "#$query##" }, searchUrl: "https://search.test" },
      createFieldSpec: () => ({ id: "id" })
    }
    const query = { queryText: "test", options: {} }

    expect(runtime.createSearcherFromSettings(settings, query).settings.searcherOptions.apiMethod).toBe("AUTO")
    expect(runtime.createSearcherFromSettings(settings, query, { forceApiMethod: "POST" }).settings.searcherOptions.apiMethod).toBe("POST")
  })

  it("preserves classic and JSON Solr echoParams behavior", () => {
    const createSearcher = vi.fn(() => ({ settings: { args: {} } }))
    const runtime = createLiveQuerySearchRuntime({
      proxyUrlFor: vi.fn(),
      isEsOrOs: vi.fn(() => false),
      evaluateMapper: vi.fn(() => ({})),
      createSearcher
    })
    const query = { queryText: "test", options: {} }
    const classic = {
      searchEngine: "solr",
      selectedTry: { args: { q: ["#$query##"] }, queryParams: "q=#$query##" },
      createFieldSpec: () => ({ id: "id" })
    }
    const json = {
      searchEngine: "solr",
      selectedTry: {
        args: { params: { query: "#$query##" } },
        queryParams: '{"query":"#$query##"}',
        jsonQueryParams: true
      },
      createFieldSpec: () => ({ id: "id" })
    }

    runtime.createSearcherFromSettings(classic, query)
    runtime.createSearcherFromSettings(json, query)

    expect(createSearcher.mock.calls[0][2].echoParams).toBe("all")
    expect(createSearcher.mock.calls[1][2].params.echoParams).toBe("all")
    expect(createSearcher.mock.calls[1][2].echoParams).toBeUndefined()
  })

  it("honors explicit and inferred Solr JSON query flags", () => {
    const createSearcher = vi.fn(() => ({ settings: { args: {} } }))
    const runtime = createLiveQuerySearchRuntime({
      proxyUrlFor: vi.fn(),
      isEsOrOs: vi.fn(() => false),
      evaluateMapper: vi.fn(() => ({})),
      createSearcher
    })
    const query = { queryText: "test", options: {} }
    const explicit = {
      searchEngine: "solr",
      selectedTry: { args: { q: ["#$query##"] }, queryParams: "irrelevant", jsonQueryParams: true },
      createFieldSpec: () => ({ id: "id" })
    }
    const inferred = {
      searchEngine: "solr",
      selectedTry: { args: { q: ["#$query##"] }, queryParams: "q=#$query##" },
      createFieldSpec: () => ({ id: "id" })
    }

    runtime.createSearcherFromSettings(explicit, query)
    runtime.createSearcherFromSettings(inferred, query)

    expect(createSearcher.mock.calls[0][4].jsonQueryDsl).toBe(true)
    expect(createSearcher.mock.calls[1][4].jsonQueryDsl).toBe(false)
  })

  it("places rated filters in Solr fq or JSON filter and preserves existing filters", () => {
    const createSearcher = vi.fn(() => ({ settings: { args: {} } }))
    const runtime = createLiveQuerySearchRuntime({
      proxyUrlFor: vi.fn(),
      isEsOrOs: vi.fn(() => false),
      evaluateMapper: vi.fn(() => ({})),
      createSearcher
    })
    const query = {
      queryText: "test",
      options: {},
      filterToRatings: () => "{!terms f=id}doc1,doc2"
    }
    const classic = {
      searchEngine: "solr",
      selectedTry: { args: { q: ["#$query##"] }, queryParams: "q=#$query##" },
      createFieldSpec: () => ({ id: "id" })
    }
    const json = {
      searchEngine: "solr",
      selectedTry: {
        args: { query: "#$query##", filter: "inStock:true" },
        queryParams: '{"query":"#$query##","filter":"inStock:true"}',
        jsonQueryParams: true
      },
      createFieldSpec: () => ({ id: "id" })
    }

    runtime.createSearcherFromSettings(classic, query, { filterToRated: true })
    runtime.createSearcherFromSettings(json, query, { filterToRated: true })

    expect(createSearcher.mock.calls[0][2].fq).toEqual(["{!terms f=id}doc1,doc2"])
    expect(createSearcher.mock.calls[1][2].filter).toEqual(["inStock:true", "{!terms f=id}doc1,doc2"])
    expect(createSearcher.mock.calls[1][2].fq).toBeUndefined()
  })
})
