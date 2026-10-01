import { describe, expect, it, vi } from "vitest"
import { createTargetedSearchAdapter } from "utils/query_runtime"

function buildAdapter(overrides = {}) {
  const query = {
    queryText: "heart",
    ratings: { doc1: 1, scale: { 1: "Not relevant" } },
    filterToRatings: vi.fn(() => "id:(doc1)"),
    touchModifiedAt: vi.fn(),
    ...overrides.query
  }
  const settings = {
    searchEngine: "solr",
    createFieldSpec: vi.fn(() => ({ id: "id" })),
    ...overrides.settings
  }
  const selectedTry = {
    tryNo: 1,
    queryParams: "q=#$query##",
    ...overrides.selectedTry
  }
  const searcher = {
    type: "solr",
    args: {},
    numFound: 1,
    search: vi.fn(() => Promise.resolve()),
    explainOther: vi.fn(() => Promise.resolve()),
    pager: vi.fn(() => null),
    ...overrides.searcher
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
    ...overrides
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

  it("mutates live rateable documents through the adapter", () => {
    const doc = { id: "doc1", rate: vi.fn(), resetRating: vi.fn() }
    const { adapter, config } = buildAdapter()
    adapter.docs = [doc]

    expect(adapter.rate("doc1", "3")).toBe(true)
    expect(doc.rate).toHaveBeenCalledWith(3)
    expect(config.query.touchModifiedAt).toHaveBeenCalledOnce()
  })
})
