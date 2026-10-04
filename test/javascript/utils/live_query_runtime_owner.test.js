import { afterEach, describe, expect, it, vi } from "vitest"
import quepidSearch from "quepid_search"
import { createLiveQueryRuntimeOwner } from "utils/live_query_runtime_owner"
import { QueryCollectionStore } from "stores/query_collection_store"

function buildOwner({ store, selectedTry = { searchEngine: "solr" }, isTrySelected = true } = {}) {
  window.quepidSearch = quepidSearch
  quepidSearch.splainerSearch = {
    searchSvc: { createSearcher: vi.fn() },
    normalDocsSvc: { createNormalDoc: vi.fn(), explainDoc: vi.fn() },
    esExplainExtractorSvc: { docsWithExplainOther: vi.fn() },
    solrExplainExtractorSvc: { docsWithExplainOther: vi.fn() }
  }

  createLiveQueryRuntimeOwner({
    search: quepidSearch,
    store,
    framework: {
      request: vi.fn(() => Promise.resolve({ data: {} })),
      get: vi.fn(() => Promise.resolve({ data: {} })),
      schedule: callback => callback(),
      logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() }
    },
    domain: {
      settings: {
        editable: vi.fn(() => ({})),
        applicable: vi.fn(() => ({ ...selectedTry, selectedTry })),
        isTrySelected: vi.fn(() => isTrySelected),
        previewArgs: vi.fn()
      },
      scorer: {
        getDefault: vi.fn(() => ({ getColors: () => [] })),
        select: vi.fn(),
        bootstrap: vi.fn()
      },
      navigation: { proxyUrlFor: vi.fn() }
    }
  })

  return window.quepidSearch
}

function buildStores() {
  return {
    queries: new QueryCollectionStore(),
    documents: {
      setShowOnlyRated: vi.fn(),
      updateQueryState: vi.fn(),
      collapseAll: vi.fn(),
      reset: vi.fn(),
      replaceQuery: vi.fn()
    }
  }
}

describe("createLiveQueryRuntimeOwner", () => {
  afterEach(() => {
    delete window.quepidStore
    delete quepidSearch.splainerSearch
    window.quepidSearch = quepidSearch
    quepidSearch.queryCapabilities.getCaseNo = null
  })

  it("installs the live-query boundary from explicit service dependencies", () => {
    const search = buildOwner({ store: window.quepidStore })

    expect(search.queryCapabilities.getCaseNo()).toBe(-1)
    expect(search.queryCommands.searchAll).toEqual(expect.any(Function))
    expect(search.queryLifecycle.refreshQueries).toEqual(expect.any(Function))
  })

  it("reports search progress from how many registered queries have been scored", () => {
    const search = buildOwner({ store: buildStores() })
    search.queryCapabilities.registerQuery(1, { queryId: 1, hasBeenScored: true })
    search.queryCapabilities.registerQuery(2, { queryId: 2, hasBeenScored: false })

    expect(search.queryCapabilities.getListState()).toMatchObject({
      searching: true,
      batchPosition: 1,
      batchSize: 2,
      canAddQueries: true,
      addQueryMessage: "Add a query to this case",
      showOnlyRated: false,
      showOnlyRatedUnsupported: false
    })
  })

  it("counts a query whose search failed as settled so the progress banner can clear", () => {
    const search = buildOwner({ store: buildStores() })
    search.queryCapabilities.registerQuery(1, { queryId: 1, hasBeenScored: true })
    search.queryCapabilities.registerQuery(2, { queryId: 2, hasBeenScored: false, errorText: "engine down" })

    expect(search.queryCapabilities.getListState()).toMatchObject({
      searching: false,
      batchPosition: 2,
      batchSize: 2
    })
  })

  it("blocks adding queries for a static engine", () => {
    const search = buildOwner({ store: buildStores(), selectedTry: { searchEngine: "static" } })

    expect(search.queryCapabilities.getListState()).toMatchObject({
      canAddQueries: false,
      addQueryMessage: "Adding queries is not supported"
    })
  })

  it("only reports show-only-rated as unsupported once a try is selected", () => {
    const algolia = { searchEngine: "algolia" }

    expect(buildOwner({ store: buildStores(), selectedTry: algolia, isTrySelected: false })
      .queryCapabilities.getListState().showOnlyRatedUnsupported).toBe(false)
    expect(buildOwner({ store: buildStores(), selectedTry: algolia, isTrySelected: true })
      .queryCapabilities.getListState().showOnlyRatedUnsupported).toBe(true)
  })

  it("toggles show-only-rated and refreshes rated docs only for queries that aren't ready", () => {
    const stores = buildStores()
    const search = buildOwner({ store: stores })
    const refreshRatedDocs = vi.spyOn(search.queryCapabilities, "refreshRatedDocs").mockReturnValue(undefined)
    const stateChanged = vi.fn()
    document.addEventListener("queries-state:changed", stateChanged)
    search.queryCapabilities.registerQuery(1, { queryId: 1, ratingsReady: true })
    search.queryCapabilities.registerQuery(2, { queryId: 2, ratingsReady: false })

    search.queryCommands.toggleShowOnlyRated()

    expect(stores.documents.setShowOnlyRated).toHaveBeenCalledWith(true)
    expect(refreshRatedDocs).toHaveBeenCalledOnce()
    expect(refreshRatedDocs).toHaveBeenCalledWith(2)
    expect(search.queryCapabilities.getListState().showOnlyRated).toBe(true)
    expect(stateChanged).toHaveBeenCalled()

    refreshRatedDocs.mockClear()
    search.queryCommands.toggleShowOnlyRated()
    expect(stores.documents.setShowOnlyRated).toHaveBeenLastCalledWith(false)
    expect(refreshRatedDocs).not.toHaveBeenCalled()
    document.removeEventListener("queries-state:changed", stateChanged)
  })

  it("toggles a query's expanded state in both stores, and ignores unknown queries", () => {
    const stores = buildStores()
    const search = buildOwner({ store: stores })
    search.queryCapabilities.registerQuery(1, { queryId: 1 })

    expect(search.queryCommands.toggleQuery(99)).toBe(false)
    expect(search.queryCommands.toggleQuery(1)).toBe(true)
    expect(stores.queries.query(1).expanded).toBe(true)
    expect(stores.documents.updateQueryState).toHaveBeenCalledWith(1, { expanded: true })

    search.queryCommands.toggleQuery(1)
    expect(stores.queries.query(1).expanded).toBe(false)
  })
})
