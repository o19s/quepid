import { describe, expect, it, vi } from "vitest"
import { createTargetedSearchAdapter } from "utils/query_runtime"

function buildAdapter(overrides = {}) {
  const {
    query: queryOverrides,
    settings: settingsOverrides,
    selectedTry: selectedTryOverrides,
    searcher: searcherOverrides,
    ...configOverrides
  } = overrides
  const query = {
    queryText: "heart",
    ratings: { doc1: 1, scale: { 1: "Not relevant" } },
    filterToRatings: vi.fn(() => "id:(doc1)"),
    touchModifiedAt: vi.fn(),
    ...queryOverrides
  }
  const settings = {
    searchEngine: "solr",
    createFieldSpec: vi.fn(() => ({ id: "id" })),
    ...settingsOverrides
  }
  const selectedTry = {
    tryNo: 1,
    queryParams: "q=#$query##",
    ...selectedTryOverrides
  }
  const searcher = {
    type: "solr",
    args: {},
    numFound: 1,
    search: vi.fn(() => Promise.resolve()),
    explainOther: vi.fn(() => Promise.resolve()),
    pager: vi.fn(() => null),
    ...searcherOverrides
  }
  const config = {
    query,
    queryId: 7,
    settings,
    selectedTry,
    engineNames: { solr: "Solr" },
    supportedEngines: ["solr"],
    previewArgs: vi.fn(() => Promise.resolve({ q: "heart" })),
    settingsWithTryOverrides: vi.fn((base, changes) => ({ ...base, ...changes })),
    createSearcherFromSettings: vi.fn(() => searcher),
    normalizeDocExplains: vi.fn(() => [{ id: "doc1" }]),
    searchApiRatedDocs: vi.fn(),
    supportsRatedDocsLookup: vi.fn(() => true),
    ...configOverrides
  }
  return { adapter: createTargetedSearchAdapter(config), config, searcher }
}

describe("targeted search adapter", () => {
  it("prefers the injected rating scale (scorer colors) over the query's own scale, which is the fallback", () => {
    const scale = { 0: { color: "red" }, 1: { color: "green" } }

    expect(buildAdapter({ ratingScale: scale }).adapter.ratingScale).toBe(scale)
    expect(buildAdapter().adapter.ratingScale).toEqual({ 1: "Not relevant" })
  })

  it("runs a preview search through injected engine dependencies", async () => {
    const { adapter, config, searcher } = buildAdapter()

    await adapter.search("q=lung")

    expect(config.previewArgs).toHaveBeenCalledWith(1, "q=lung")
    expect(config.settingsWithTryOverrides).toHaveBeenCalledWith(
      config.settings,
      { args: { q: "heart" }, queryParams: "q=lung" }
    )
    expect(searcher.search).toHaveBeenCalled()
    expect(adapter.docs).toEqual([{ id: "doc1" }])
    expect(adapter.numFound).toBe(1)
  })

  it("keeps parse failures in adapter state without constructing a searcher", async () => {
    const { adapter, config } = buildAdapter({
      previewArgs: vi.fn(() => Promise.resolve(null))
    })

    await adapter.search("q=[invalid")

    expect(adapter.parseError).toBe(true)
    expect(adapter.docs).toEqual([])
    expect(config.createSearcherFromSettings).not.toHaveBeenCalled()
  })

  it("loads and pages the rated-document list", async () => {
    const nextSearcher = {
      type: "solr",
      args: {},
      numFound: 2,
      search: vi.fn(() => Promise.resolve()),
      explainOther: vi.fn(() => Promise.resolve())
    }
    const { adapter, config } = buildAdapter({
      createSearcherFromSettings: vi.fn()
        .mockReturnValueOnce({
          type: "solr",
          args: { start: 4 },
          explainOther: vi.fn(() => Promise.resolve())
        })
        .mockReturnValueOnce(nextSearcher),
      normalizeDocExplains: vi.fn()
        .mockReturnValueOnce([{ id: "doc1" }])
        .mockReturnValueOnce([{ id: "doc2" }])
    })

    await adapter.resetToRated()
    await adapter.paginate()

    expect(config.query.filterToRatings).toHaveBeenCalled()
    expect(adapter.docs).toEqual([{ id: "doc1" }, { id: "doc2" }])
    expect(adapter.paging).toBe(false)
  })

  it("fills the query text into every placeholder of the initial query params", () => {
    const { adapter } = buildAdapter({ selectedTry: { queryParams: "q=#$query##&pf=#$query##" } })

    expect(adapter.initialQueryParams()).toBe("q=heart&pf=heart")
    expect(buildAdapter({ selectedTry: { queryParams: "" } }).adapter.initialQueryParams()).toBe("")
  })

  it.each([
    ["a plain query", () => false],
    ["a search template", () => true]
  ])("filters an ES rated-document list by id for %s", async (_label, isTemplateCall) => {
    const searcherArgs = { id: "tmpl", params: { q: 1 }, size: 10 }
    const { adapter, searcher } = buildAdapter({
      settings: { searchEngine: "es" },
      supportedEngines: ["es"],
      searcher: { type: "es", args: searcherArgs, isTemplateCall }
    })

    await adapter.resetToRated()

    expect(searcher.queryDsl).toEqual({ query: "id:(doc1)" })
    expect(adapter.docs).toEqual([{ id: "doc1" }])
    if (isTemplateCall()) {
      expect(searcher.search).toHaveBeenCalledWith({ query: "id:(doc1)" })
      expect(searcherArgs).toEqual({ size: 10 })
    } else {
      expect(searcher.search).toHaveBeenCalledWith()
      expect(searcherArgs).toHaveProperty("id", "tmpl")
    }
  })

  it("shows rated counts without searching when the engine can't look up rated docs", async () => {
    const unsupported = buildAdapter({ query: { ratings: { doc1: 1 } }, supportsRatedDocsLookup: vi.fn(() => false) })
    await unsupported.adapter.resetToRated()
    expect(unsupported.adapter).toMatchObject({ ratedDocsLookupUnsupported: true, numFound: 0, totalRatings: 1, defaultList: true })
    expect(unsupported.searcher.explainOther).not.toHaveBeenCalled()

    const noEditor = buildAdapter({ query: { ratings: { doc1: 1 } }, supportedEngines: [] })
    await noEditor.adapter.resetToRated()
    expect(noEditor.config.createSearcherFromSettings).not.toHaveBeenCalled()
    expect(noEditor.adapter.numFound).toBe(1)
  })

  it("uses the Search API rated-doc lookup result when there is one", async () => {
    const ratedSearcher = { type: "searchapi" }
    const { adapter } = buildAdapter({
      settings: { searchEngine: "searchapi" },
      supportedEngines: ["searchapi"],
      searcher: { type: "searchapi" },
      searchApiRatedDocs: vi.fn(() => Promise.resolve({ searcher: ratedSearcher, docs: [{ id: "r1" }] }))
    })

    await adapter.resetToRated()

    expect(adapter.searcher).toBe(ratedSearcher)
    expect(adapter.docs).toEqual([{ id: "r1" }])
  })

  it("pages a preview search by appending the next page, and stops when there is none", async () => {
    const nextSearcher = { type: "solr", numFound: 5, search: vi.fn(() => Promise.resolve()), pager: () => null }
    const { adapter, searcher } = buildAdapter({
      normalizeDocExplains: vi.fn().mockReturnValueOnce([{ id: "doc1" }]).mockReturnValueOnce([{ id: "doc2" }])
    })
    searcher.pager = vi.fn(() => nextSearcher)

    await adapter.search("q=heart")
    await adapter.paginate()
    expect(adapter.docs).toEqual([{ id: "doc1" }, { id: "doc2" }])
    expect(adapter).toMatchObject({ numFound: 5, paging: false })

    await adapter.paginate()
    expect(adapter.searcher).toBeNull()
    expect(adapter.paging).toBe(false)
  })

  it("rates every listed document in bulk, or clears them all", () => {
    const first = { id: 1, rateBulk: vi.fn(), resetBulkRatings: vi.fn() }
    const { adapter, config } = buildAdapter()

    expect(adapter.rateAll("2")).toBe(true)
    expect(config.query.touchModifiedAt).not.toHaveBeenCalled()

    adapter.docs = [first, { id: 2 }]
    adapter.rateAll("2")
    adapter.rateAll(null)

    expect(first.rateBulk).toHaveBeenCalledWith([1, 2], 2)
    expect(first.resetBulkRatings).toHaveBeenCalledWith([1, 2])
    expect(config.query.touchModifiedAt).toHaveBeenCalledTimes(2)
  })

  it("clears a single rating, and ignores documents that aren't listed", () => {
    const doc = { id: 7, rate: vi.fn(), resetRating: vi.fn() }
    const { adapter, config } = buildAdapter()
    adapter.docs = [doc]

    expect(adapter.rate("7", null)).toBe(true)
    expect(doc.resetRating).toHaveBeenCalledOnce()
    expect(adapter.rate("missing", 1)).toBe(false)
    expect(config.query.touchModifiedAt).toHaveBeenCalledOnce()
  })

  it("mutates live rateable documents through the adapter", () => {
    const doc = { id: "doc1", rate: vi.fn(), resetRating: vi.fn() }
    const { adapter, config } = buildAdapter()
    adapter.docs = [doc]

    expect(adapter.rate("doc1", "3")).toBe(true)
    expect(doc.rate).toHaveBeenCalledWith(3)
    expect(config.query.touchModifiedAt).toHaveBeenCalledOnce()
  })
})
