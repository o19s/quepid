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
})
