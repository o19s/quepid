import { afterEach, describe, expect, it, vi } from "vitest"
import quepidSearch from "quepid_search"
import { createLiveQueryRuntimeOwner } from "utils/live_query_runtime_owner"
import { QueryCollectionStore } from "stores/query_collection_store"

function buildOwner({
  store,
  selectedTry = { searchEngine: "solr" },
  isTrySelected = true,
  searcher,
  scorer = { getColors: () => [] },
  bootstrapScorer = vi.fn()
} = {}) {
  window.quepidSearch = quepidSearch
  quepidSearch.splainerSearch = {
    searchSvc: { createSearcher: vi.fn(() => searcher) },
    normalDocsSvc: { createNormalDoc: vi.fn((_spec, doc) => ({ ...doc })), explainDoc: vi.fn() },
    esExplainExtractorSvc: { docsWithExplainOther: vi.fn() },
    solrExplainExtractorSvc: { docsWithExplainOther: vi.fn() }
  }

  createLiveQueryRuntimeOwner({
    search: quepidSearch,
    store: { scoring: new EventTarget(), ...store },
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
        getDefault: vi.fn(() => scorer),
        select: vi.fn(),
        bootstrap: bootstrapScorer
      },
      navigation: { proxyUrlFor: vi.fn() }
    }
  })

  return window.quepidSearch
}

const jsonResponse = (data) => ({
  ok: true,
  status: 200,
  json: async () => data,
  text: async () => JSON.stringify(data)
})

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
    vi.unstubAllGlobals()
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
    const stores = buildStores()
    const search = buildOwner({ store: stores })
    stores.queries.upsert({ queryId: 1, hasBeenScored: true })
    stores.queries.upsert({ queryId: 2, hasBeenScored: false })

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
    const stores = buildStores()
    const search = buildOwner({ store: stores })
    stores.queries.upsert({ queryId: 1, hasBeenScored: true })
    stores.queries.upsert({ queryId: 2, hasBeenScored: false, errorText: "engine down" })

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
    stores.queries.upsert({ queryId: 1, ratingsReady: true })
    stores.queries.upsert({ queryId: 2, ratingsReady: false })

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
    stores.queries.upsert({ queryId: 1 })

    expect(search.queryCommands.toggleQuery(99)).toBe(false)
    expect(search.queryCommands.toggleQuery(1)).toBe(true)
    expect(stores.queries.query(1).expanded).toBe(true)
    expect(stores.documents.updateQueryState).toHaveBeenCalledWith(1, { expanded: true })

    search.queryCommands.toggleQuery(1)
    expect(stores.queries.query(1).expanded).toBe(false)
  })

  async function addQuery() {
    const stores = buildStores()
    stores.scoring = { setLatestScoreInfo: vi.fn(), markRatingChanged: vi.fn(), addEventListener: vi.fn() }
    const searcher = {
      type: "solr",
      docs: [{ id: "d1" }, { id: "d2" }],
      numFound: 2,
      linkUrl: "http://solr/select?q=star",
      search: vi.fn(() => Promise.resolve())
    }
    const scorer = { score: vi.fn(() => 0.5), maxScore: () => 1, getColors: () => ({}) }
    const search = buildOwner({ store: stores, searcher, scorer })
    const settings = {
      searchEngine: "solr",
      selectedTry: { searchUrl: "http://solr/select", args: { q: ["#$query##"] }, requestsPerMinute: 0 },
      createFieldSpec: () => ({ id: "id" })
    }
    await search.queryCapabilities.changeSettings(-1, settings)

    const prepared = search.queryLifecycle.prepareQueries(["star wars"])
    const committed = await search.queryLifecycle.commitQueries(prepared, {
      status: 201,
      data: { display_order: [5], query: { query_id: 5 } }
    })
    // The commit fires its case-wide rescore without awaiting it.
    await vi.waitFor(() => expect(stores.scoring.setLatestScoreInfo).toHaveBeenCalled())

    return { stores, searcher, search, settings, committed }
  }

  it("runs an added query through search, documents, and scoring", async () => {
    const { stores, search, committed } = await addQuery()

    expect(committed).toEqual({})
    const query = search.queryCapabilities.getQuery(5)
    expect(query.queryText).toBe("star wars")
    expect(quepidSearch.splainerSearch.searchSvc.createSearcher).toHaveBeenCalledWith(
      { id: "id" }, "http://solr/select", expect.anything(), "star wars", expect.anything(), "solr"
    )
    expect(query.linkUrl).toBe("http://solr/select?q=star")
    expect(query.docs.map((doc) => doc.id)).toEqual(["d1", "d2"])
    expect(query.hasBeenScored).toBe(true)
    expect(query.lastScore).toBe(0.5)
    expect(stores.documents.replaceQuery).toHaveBeenCalledWith(5, expect.any(Object))
  })

  it("reruns every registered query and completes the collection store's search", async () => {
    const { stores, searcher, search } = await addQuery()
    searcher.search.mockClear()
    stores.scoring.setLatestScoreInfo.mockClear()
    const searchStarted = vi.fn()
    stores.queries.addEventListener("search-started", searchStarted)

    await search.queryCommands.searchAll()

    expect(searchStarted).toHaveBeenCalledOnce()
    expect(searcher.search).toHaveBeenCalled()
    expect(search.queryCapabilities.getQuery(5).hasBeenScored).toBe(true)
    expect(stores.queries.searchStatus).toBe("ready")
    expect(stores.scoring.setLatestScoreInfo).toHaveBeenCalledOnce()
  })

  it("refreshes every query's diff, republishes it, and reports success", async () => {
    const { stores, search } = await addQuery()
    stores.documents.replaceQuery.mockClear()
    const refreshed = vi.fn()
    document.addEventListener("query-diffs:refreshed", refreshed)

    await search.queryCapabilities.refreshAllDiffs()

    expect(search.queryCapabilities.getQuery(5).diff).toBeNull()
    expect(stores.documents.replaceQuery).toHaveBeenCalledTimes(2)
    expect(refreshed.mock.calls[0][0].detail).toEqual({ success: true })
    document.removeEventListener("query-diffs:refreshed", refreshed)
  })

  it("refetches existing diffs when settings change within the same case", async () => {
    const { search, settings } = await addQuery()
    const query = search.queryCapabilities.getQuery(5)
    query.diff = { fetch: vi.fn() }

    await search.queryCapabilities.changeSettings(-1, settings)

    expect(query.diff.fetch).toHaveBeenCalledOnce()
  })

  it("bootstraps a newly selected case, and a reset returns the store to idle", async () => {
    const stores = buildStores()
    const fetch = vi.fn((url) => Promise.resolve(jsonResponse(
      String(url).includes("/queries")
        ? { display_order: [7], queries: [{ query_id: 7, query_text: "dune" }] }
        : { book_id: null, auto_populate_book_pairs: false }
    )))
    vi.stubGlobal("fetch", fetch)
    const bootstrapScorer = vi.fn()
    const search = buildOwner({ store: stores, bootstrapScorer })

    await search.queryCapabilities.changeSettings(2, {
      searchEngine: "solr",
      selectedTry: { requestsPerMinute: 0 },
      createFieldSpec: () => ({ id: "id" })
    })

    expect(bootstrapScorer).toHaveBeenCalledWith(2)
    expect(search.queryCapabilities.getCaseNo()).toBe(2)
    expect(search.queryCapabilities.getQuery(7).queryText).toBe("dune")
    expect(stores.queries.status).toBe("ready")
    expect(fetch.mock.calls.map(([url]) => String(url))).not.toContainEqual(
      expect.stringMatching(/api\/cases\/2$/)
    )

    search.queryCapabilities.resetQueryState()

    expect(stores.queries.status).toBe("idle")
    expect(search.queryCapabilities.getQuery(7)).toBeNull()
  })
})
