import { describe, expect, it, vi } from "vitest"
import { createQueryRuntime, createSearchAllRuntime } from "utils/query_runtime"

function buildRuntime(overrides = {}) {
  const { query: queryOverrides = {}, ...runtimeOverrides } = overrides
  const query = {
    searcher: null,
    ratedSearcher: null,
    docs: [],
    ratedDocs: [],
    ratingsStore: { id: "ratings" },
    ...queryOverrides
  }
  const publish = vi.fn()
  const runtimeConfig = {
    getSettings: () => ({ createFieldSpec: () => ({ id: "id" }) }),
    copySettings: (settings) => ({ ...settings }),
    createSearcher: vi.fn(() => ({ search: vi.fn(() => Promise.resolve()), docs: [], numFound: 0 })),
    createRatedSearcher: vi.fn(() => ({ search: vi.fn(() => Promise.resolve()), linkUrl: "rated" })),
    searchApiRatedDocs: vi.fn(),
    supportsSearchApiRatedDocsLookup: vi.fn(() => true),
    createSnapshotSearcher: vi.fn(),
    normalizeDocuments: vi.fn(() => [{ id: "rated-2" }]),
    createDocList: vi.fn(() => ({ list: () => [{ id: "doc-2" }] })),
    createRateableDoc: vi.fn((doc) => ({ ...doc, rateable: true })),
    matchFeaturesExplain: vi.fn(),
    setDocs: vi.fn(() => undefined),
    onError: vi.fn(),
    parseError: vi.fn(),
    publish,
    logger: { debug: vi.fn() }
  }
  Object.assign(runtimeConfig, runtimeOverrides)
  runtimeConfig.query = query
  const runtime = createQueryRuntime(runtimeConfig)
  return { query, runtime, publish }
}

describe("query runtime", () => {
  it("orchestrates the complete search lifecycle through injected callbacks", async () => {
    const callbacks = {
      search: vi.fn(() => Promise.resolve()),
      score: vi.fn(() => Promise.resolve()),
      scoreAll: vi.fn(() => Promise.resolve()),
      syncToBook: vi.fn(),
      onSearchStarted: vi.fn(),
      onSearchCompleted: vi.fn(),
      onSearchFailed: vi.fn(),
      logger: { debug: vi.fn() }
    }
    const runtime = createSearchAllRuntime({
      queries: { first: { id: "first" } },
      requestsPerMinute: 0,
      ...callbacks
    })

    await runtime.run()

    expect(callbacks.onSearchStarted).toHaveBeenCalled()
    expect(callbacks.search).toHaveBeenCalledWith({ id: "first" })
    expect(callbacks.score).toHaveBeenCalledWith({ id: "first" })
    expect(callbacks.scoreAll).toHaveBeenCalled()
    expect(callbacks.syncToBook).toHaveBeenCalled()
    expect(callbacks.onSearchCompleted).toHaveBeenCalled()
    expect(callbacks.onSearchFailed).not.toHaveBeenCalled()
  })

  it("delegates live search while keeping searcher construction injected", async () => {
    const searcher = { search: vi.fn(() => Promise.resolve()), docs: [], numFound: 0 }
    const createSearcher = vi.fn(() => searcher)
    const setDocs = vi.fn(() => undefined)
    const { query, runtime } = buildRuntime({ createSearcher, setDocs })

    await runtime.search()

    expect(createSearcher).toHaveBeenNthCalledWith(1)
    expect(createSearcher).toHaveBeenNthCalledWith(2, { filterToRated: true })
    expect(query.searcher).toBe(searcher)
    expect(setDocs).toHaveBeenCalledWith([], 0)
  })

  it("appends normalized documents when paging", async () => {
    const nextSearcher = { docs: [{ id: "raw" }], search: vi.fn(() => Promise.resolve()) }
    const query = {
      searcher: { pager: vi.fn(() => nextSearcher) },
      docs: [{ id: "doc-1" }],
      ratedDocs: [],
      ratingsStore: {}
    }
    const { query: runtimeQuery, runtime, publish } = buildRuntime({ query })

    await runtime.paginate()

    expect(runtimeQuery.docs).toEqual([{ id: "doc-1" }, { id: "doc-2" }])
    expect(publish).toHaveBeenCalledWith(runtimeQuery)
  })

  it("handles rated-result paging through the injected normalization seam", async () => {
    const nextSearcher = { search: vi.fn(() => Promise.resolve()) }
    const query = {
      searcher: null,
      ratedSearcher: { pager: vi.fn(() => nextSearcher) },
      docs: [],
      ratedDocs: [{ id: "rated-1" }],
      ratingsStore: {}
    }
    const { query: runtimeQuery, runtime, publish } = buildRuntime({ query })

    await runtime.ratedPaginate()

    expect(runtimeQuery.ratedDocs).toEqual([{ id: "rated-1" }, { id: "rated-2" }])
    expect(publish).toHaveBeenCalledWith(runtimeQuery)
  })

  it("refreshes rated documents through the injected searcher boundary", async () => {
    const ratedSearcher = {
      linkUrl: "rated-url",
      search: vi.fn(() => Promise.resolve()),
      numFound: 2
    }
    const createRatedSearcher = vi.fn(() => ratedSearcher)
    const normalizeDocuments = vi.fn(() => [{ id: "rated-1" }, { id: "rated-2" }])
    const createRateableDoc = vi.fn((doc) => ({ ...doc, rateable: true }))
    const { query, runtime, publish } = buildRuntime({
      query: { ratings: { first: 1 }, ratingsGeneration: 0, ratingsReady: false },
      createRatedSearcher,
      normalizeDocuments,
      createRateableDoc
    })

    await runtime.refreshRatedDocs(25)

    expect(createRatedSearcher).toHaveBeenCalledWith(
      expect.objectContaining({ numberOfRows: 25 })
    )
    expect(normalizeDocuments).toHaveBeenCalledWith(
      ratedSearcher,
      expect.objectContaining({ id: "id" })
    )
    expect(query.ratedDocs).toEqual([
      { id: "rated-1", rateable: true },
      { id: "rated-2", rateable: true }
    ])
    expect(query.ratedDocsFound).toBe(2)
    expect(query.ratingsReady).toBe(true)
    expect(publish).toHaveBeenCalledWith(query)
  })

  it("does not expose unsupported Search API rated lookups as rated results", async () => {
    const { query, runtime, publish } = buildRuntime({
      query: { ratings: { first: 1 }, ratingsReady: false },
      getSettings: () => ({
        searchEngine: "searchapi",
        selectedTry: {},
        createFieldSpec: () => ({ id: "id" })
      }),
      supportsSearchApiRatedDocsLookup: vi.fn(() => false)
    })

    await runtime.refreshRatedDocs()

    expect(query.ratedDocsUnsupported).toBe(true)
    expect(query.ratedDocs).toEqual([])
    expect(query.ratingsReady).toBe(true)
    expect(publish).toHaveBeenCalledWith(query)
  })

  it("retries rated refresh when ratings change during the request", async () => {
    let resolveSearch
    const searchPromise = new Promise((resolve) => {
      resolveSearch = resolve
    })
    const createRatedSearcher = vi
      .fn()
      .mockReturnValueOnce({ search: () => searchPromise, linkUrl: "stale" })
      .mockReturnValueOnce({
        search: vi.fn(() => Promise.resolve()),
        linkUrl: "fresh",
        numFound: 1
      })
    const { query, runtime } = buildRuntime({
      query: { ratings: { first: 1 }, ratingsGeneration: 0, ratingsReady: false },
      createRatedSearcher,
      normalizeDocuments: vi.fn(() => [{ id: "fresh-doc" }])
    })

    const refresh = runtime.refreshRatedDocs()
    query.ratingsGeneration = 1
    resolveSearch()
    await refresh

    expect(createRatedSearcher).toHaveBeenCalledTimes(2)
    expect(query.ratedDocs).toEqual([{ id: "fresh-doc", rateable: true }])
  })

  it("reports missing snapshots through the injected error boundary", async () => {
    const onError = vi.fn()
    const { runtime } = buildRuntime({ createSnapshotSearcher: vi.fn(() => null), onError })

    await expect(runtime.searchFromSnapshot(42)).rejects.toBe("Snapshot not found: 42")
    expect(onError).toHaveBeenCalledWith("Snapshot not found: 42")
  })

  it("converts synchronous snapshot construction failures into rejections", async () => {
    const error = new Error("malformed snapshot")
    const { runtime } = buildRuntime({ createSnapshotSearcher: vi.fn(() => { throw error }) })

    await expect(runtime.searchFromSnapshot(42)).rejects.toBe(error)
  })

  it("converts synchronous snapshot search failures into rejections", async () => {
    const error = new Error("snapshot search failed")
    const { runtime } = buildRuntime({
      createSnapshotSearcher: vi.fn(() => ({ search: vi.fn(() => { throw error }) }))
    })

    await expect(runtime.searchFromSnapshot(42)).rejects.toBe(error)
  })
})
