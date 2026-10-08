import { describe, expect, it, vi } from "vitest"
import { createQueryRuntime } from "utils/query_runtime"

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
  it("looks up newly rated documents after an empty mapper lookup", async () => {
    const lookup = vi.fn().mockResolvedValue({ searcher: { numFound: 1 }, docs: [{ id: "first" }] })
    const { runtime, query } = buildRuntime({
      query: { ratings: {}, ratingsGeneration: 0 },
      getSettings: () => ({ searchEngine: "searchapi", selectedTry: {} }),
      searchApiRatedDocs: lookup
    })
    await runtime.refreshRatedDocs()
    expect(query.ratingsPromise).toBeNull()
    query.ratings.first = 1
    query.ratingsGeneration++
    query.ratingsReady = false
    await runtime.refreshRatedDocs()
    expect(lookup).toHaveBeenCalledOnce()
    expect(query.ratedDocs).toHaveLength(1)
  })

  it("retains the total rated-result count across a partial first page", async () => {
    const { runtime, query } = buildRuntime({
      createRatedSearcher: () => ({ search: () => Promise.resolve(), numFound: 25 })
    })
    await runtime.refreshRatedDocs()
    expect(query.ratedDocs).toHaveLength(1)
    expect(query.ratedDocsFound).toBe(25)
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

  it("tells the user to pick a search endpoint when no searcher can be built", async () => {
    const onError = vi.fn()
    const createSearcher = vi.fn(() => null)
    const { query, runtime } = buildRuntime({ query: { hasBeenScored: true }, createSearcher, onError })
    const message = "No Search Endpoint configured. Please select a search endpoint in Settings."

    await expect(runtime.search()).rejects.toBe(message)

    expect(onError).toHaveBeenCalledWith(message)
    expect(query.hasBeenScored).toBe(false)
    expect(createSearcher).toHaveBeenCalledOnce()
  })

  it("rejects with the translated error when the search request fails", async () => {
    const searcher = { search: vi.fn().mockRejectedValue({ status: 502 }) }
    const setDocs = vi.fn(() => undefined)
    const onError = vi.fn()
    const { runtime } = buildRuntime({
      createSearcher: () => searcher,
      setDocs,
      onError,
      parseError: () => "translated error"
    })

    await expect(runtime.search()).rejects.toBe("translated error")
    expect(setDocs).toHaveBeenCalledWith([], 0)
    expect(onError).toHaveBeenCalledWith("translated error")
  })

  it("rejects when the searcher reports an error state", async () => {
    const searcher = { inError: true, search: vi.fn().mockResolvedValue(undefined) }
    const setDocs = vi.fn(() => undefined)
    const onError = vi.fn()
    const { runtime } = buildRuntime({ createSearcher: () => searcher, setDocs, onError })

    await expect(runtime.search()).rejects.toBe("Please click browse to see the error")
    expect(setDocs).toHaveBeenCalledWith([], 0)
    expect(onError).toHaveBeenCalledWith("Please click browse to see the error")
  })

  it("rejects with the error setDocs reports", async () => {
    const searcher = { search: vi.fn(() => Promise.resolve()), docs: [], numFound: 0 }
    const onError = vi.fn()
    const { runtime } = buildRuntime({
      createSearcher: () => searcher,
      setDocs: () => "too many docs",
      onError
    })

    await expect(runtime.search()).rejects.toBe("too many docs")
    expect(onError).toHaveBeenCalledWith("too many docs")
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

  it("loads Search API rated documents by id and publishes them", async () => {
    const searcher = { linkUrl: "rated-url", numFound: 2 }
    const searchApiRatedDocs = vi.fn(() => Promise.resolve({ searcher, docs: [{ id: "a" }, { id: "b" }] }))
    const settings = { searchEngine: "searchapi", selectedTry: {}, createFieldSpec: () => ({}) }
    const { query, runtime, publish } = buildRuntime({
      query: { ratings: { a: 1, "": 2, b: 3 }, ratingsGeneration: 0 },
      getSettings: () => settings,
      searchApiRatedDocs
    })

    await runtime.refreshRatedDocs()

    expect(searchApiRatedDocs).toHaveBeenCalledWith(expect.objectContaining({ searchEngine: "searchapi" }), query, ["a", "b"])
    expect(query).toMatchObject({
      ratedSearcher: searcher,
      ratedUrl: "rated-url",
      ratedDocs: [{ id: "a", rateable: true }, { id: "b", rateable: true }],
      ratedDocsFound: 2,
      ratingsReady: true,
      ratingsPromise: null
    })
    expect(publish).toHaveBeenCalledWith(query)
  })

  it("treats a Search API rated lookup with no ratings, or a null result, as empty", async () => {
    const getSettings = () => ({ searchEngine: "searchapi", selectedTry: {}, createFieldSpec: () => ({}) })
    const searchApiRatedDocs = vi.fn(() => Promise.resolve(null))

    const noRatings = buildRuntime({ query: { ratings: {}, ratedDocs: [{ id: "old" }] }, getSettings, searchApiRatedDocs })
    await noRatings.runtime.refreshRatedDocs()
    expect(searchApiRatedDocs).not.toHaveBeenCalled()
    expect(noRatings.query).toMatchObject({ ratedDocs: [], ratedDocsFound: 0, ratingsReady: true })

    const nullResult = buildRuntime({ query: { ratings: { a: 1 }, ratingsGeneration: 0 }, getSettings, searchApiRatedDocs })
    await nullResult.runtime.refreshRatedDocs()
    expect(nullResult.query).toMatchObject({ ratedDocsUnsupported: true, ratedDocs: [], ratingsPromise: null })
  })

  it("shares an in-flight rated refresh and clears it after a failure so the next call retries", async () => {
    const error = new Error("engine down")
    const createRatedSearcher = vi
      .fn()
      .mockReturnValueOnce({ search: () => Promise.reject(error) })
      .mockReturnValueOnce({ search: () => Promise.resolve(), linkUrl: "ok" })
    const { query, runtime } = buildRuntime({ query: { ratingsGeneration: 0 }, createRatedSearcher })

    const first = runtime.refreshRatedDocs()
    expect(runtime.refreshRatedDocs()).toBe(first)
    await expect(first).rejects.toBe(error)
    expect(query.ratingsPromise).toBeNull()

    await runtime.refreshRatedDocs()
    expect(createRatedSearcher).toHaveBeenCalledTimes(2)
  })
})
