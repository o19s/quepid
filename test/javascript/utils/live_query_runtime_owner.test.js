import { afterEach, describe, expect, it, vi } from "vitest"
import { createLiveQueryRuntimeOwner } from "utils/live_query_runtime_owner"
import { QueryDocumentsStore } from "stores/query_documents_store"
import { CaseScoreStore } from "stores/case_score_store"
import { QueryCollectionStore } from "stores/query_collection_store"

function buildOwner({
  store,
  selectedTry = { searchEngine: "solr" },
  isTrySelected = true,
  searcher,
  scorer = { getColors: () => [] },
  bootstrapScorer = vi.fn(),
  editable = {},
  previewArgs = vi.fn(),
  proxyUrlFor = vi.fn(),
  eventTarget = new EventTarget()
} = {}) {
  const splainerSearch = {
    searchSvc: { createSearcher: vi.fn(() => searcher) },
    normalDocsSvc: { createNormalDoc: vi.fn((_spec, doc) => ({ ...doc })), explainDoc: vi.fn() },
    esExplainExtractorSvc: { docsWithExplainOther: vi.fn() },
    solrExplainExtractorSvc: { docsWithExplainOther: vi.fn() }
  }

  const runtime = createLiveQueryRuntimeOwner({
    splainerSearch,
    snapshotRegistry: {},
    eventTarget,
    store: { scoring: new EventTarget(), ...store },
    framework: {
      request: vi.fn(() => Promise.resolve({ data: {} })),
      get: vi.fn(() => Promise.resolve({ data: {} })),
      schedule: callback => callback(),
      logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() }
    },
    domain: {
      settings: {
        editable: vi.fn(() => editable),
        applicable: vi.fn(() => ({ ...selectedTry, selectedTry })),
        isTrySelected: vi.fn(() => isTrySelected),
        previewArgs
      },
      scorer: {
        getDefault: vi.fn(() => scorer),
        select: vi.fn(),
        bootstrap: bootstrapScorer
      },
      navigation: { proxyUrlFor }
    }
  })

  return { ...runtime, splainerSearch }
}

const jsonResponse = (data) => ({
  ok: true,
  status: 200,
  json: async () => data,
  text: async () => JSON.stringify(data)
})

function buildStores() {
  const queries = new QueryCollectionStore()
  return { queries, documents: new QueryDocumentsStore({ queries }), scoring: new CaseScoreStore() }
}

describe("createLiveQueryRuntimeOwner", () => {
  it.each(["removed", "replaced"])("ignores a pending rated response for a %s query", async disposition => {
    const stores = buildStores()
    let resolveSearch
    const searcher = {
      type: "solr", docs: [{ id: "rated" }], numFound: 1,
      search: () => new Promise(resolve => { resolveSearch = resolve })
    }
    const search = buildOwner({ store: stores, searcher })
    search.splainerSearch.solrExplainExtractorSvc.docsWithExplainOther.mockImplementation(docs => docs)
    await search.queryCapabilities.changeSettings(-1, {
      searchEngine: "solr", selectedTry: { searchUrl: "http://solr", args: {} },
      createFieldSpec: () => ({ id: "id" })
    })
    const query = {
      queryId: 7, docs: [], ratedDocs: [], ratings: {},
      ratingsGeneration: 0, ratingsStore: { createRateableDoc: doc => doc },
      filterToRatings: () => "{!terms f=id}rated"
    }
    stores.queries.upsert(query)
    const pending = search.queryCapabilities.refreshRatedDocs(7)
    search.queryCapabilities.reconcileQueryRemoval(7)
    const replacement = { ...query, docs: [], ratedDocs: [] }
    if (disposition === "replaced") stores.queries.upsert(replacement)
    resolveSearch()
    await pending
    expect(stores.queries.liveQuery(7)).toBe(disposition === "removed" ? null : replacement)
    expect(stores.documents.query(7)?.ratedDocs || []).toEqual([])
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete window.quepidStore
  })

  it("returns the live-query boundary from explicit service dependencies", () => {
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

    expect(stores.documents.snapshot().showOnlyRated).toBe(true)
    expect(refreshRatedDocs).toHaveBeenCalledOnce()
    expect(refreshRatedDocs).toHaveBeenCalledWith(2)
    expect(search.queryCapabilities.getListState().showOnlyRated).toBe(true)
    expect(stateChanged).toHaveBeenCalled()

    refreshRatedDocs.mockClear()
    search.queryCommands.toggleShowOnlyRated()
    expect(stores.documents.snapshot().showOnlyRated).toBe(false)
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
    stores.documents.replaceQuery(1)
    expect(stores.documents.query(1).expanded).toBe(true)

    search.queryCommands.toggleQuery(1)
    expect(stores.queries.query(1).expanded).toBe(false)
  })

  async function addQuery({ syncConflict = false } = {}) {
    const stores = buildStores()
    vi.spyOn(stores.scoring, "setLatestScoreInfo")
    const searcher = {
      type: "solr",
      docs: [{ id: "d1" }, { id: "d2" }],
      numFound: 2,
      linkUrl: "http://solr/select?q=star",
      search: vi.fn(() => Promise.resolve())
    }
    const scorer = { score: vi.fn(() => 0.5), maxScore: () => 1, getColors: () => ({}) }
    vi.spyOn(stores.documents, "replaceQuery")
    const eventTarget = new EventTarget()
    const search = buildOwner({ store: stores, searcher, scorer, eventTarget })
    const settings = {
      searchEngine: "solr",
      selectedTry: { searchUrl: "http://solr/select", args: { q: ["#$query##"] }, requestsPerMinute: 0 },
      createFieldSpec: () => ({ id: "id" })
    }
    await search.queryCapabilities.changeSettings(-1, settings)

    if (syncConflict) {
      vi.stubGlobal("fetch", vi.fn(async () => ({
        ok: false, status: 409, json: async () => null
      })))
      eventTarget.dispatchEvent(new CustomEvent("quepid:case-book-updated", {
        detail: { caseId: -1, bookId: 7, autoPopulateBookPairs: true }
      }))
    }

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
    expect(search.splainerSearch.searchSvc.createSearcher).toHaveBeenCalledWith(
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

  it("publishes an added query's case scores despite a busy book and retries its pairs", async () => {
    const { stores, search, committed } = await addQuery({ syncConflict: true })

    expect(committed.searchError.message).toContain("Book auto-sync")
    expect(stores.scoring.queryScore(5)).toMatchObject({ score: 0.5, countMissingRatings: 2 })
    expect(stores.scoring.caseScore.score).toBe(0.5)
    expect(stores.documents.query(5).errorText).toBeFalsy()
    const rejectedPayload = JSON.parse(fetch.mock.calls[0][1].body)

    fetch.mockResolvedValue({ ok: true, status: 204 })
    await search.queryCommands.searchAll()

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual(rejectedPayload)
    expect(stores.queries.searchStatus).toBe("ready")
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
  it("uses the collection order before and after bootstrap and clears preferences on reset", () => {
    const stores = buildStores()
    const search = buildOwner({ store: stores })
    stores.queries.upsert({ queryId: 1 })
    stores.queries.upsert({ queryId: 2 })
    search.queryCapabilities.setDisplayOrder([2, 1])
    expect(search.queryCapabilities.getQueryArray().map(query => query.queryId)).toEqual([2, 1])
    stores.queries.setExpanded(1, true)
    stores.documents.replaceQuery(1)
    search.queryCommands.collapseAll()
    expect(stores.queries.query(1).expanded).toBe(false)
    expect(stores.documents.query(1).expanded).toBe(false)
    stores.queries.setShowOnlyRated(true)
    search.queryCapabilities.resetQueryState()
    expect(search.queryCapabilities.getListState().showOnlyRated).toBe(false)
    expect(stores.documents.snapshot().queries).toEqual({})
    expect(search.queryCapabilities.getQueryArray()).toEqual([])
  })

  it("keeps live, collection, document and completed case scores consistent after a rating", async () => {
    const { stores, search } = await addQuery()
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse({}))))
    const query = search.queryCapabilities.getQuery(5)
    expect(stores.documents.query(5)).toMatchObject({ allRated: false, missingRatings: 2 })
    const completed = stores.scoring.queryScore(5)
    expect(completed).toMatchObject({ score: 0.5, allRated: false, countMissingRatings: 2 })

    await query.ratingsStore.rateBulkDocuments(["d1", "d2"], 1)
    await vi.waitFor(() => expect(stores.scoring.queryScore(5).allRated).toBe(true))
    expect(query.currentScore).toMatchObject({ score: 0.5, allRated: true, countMissingRatings: 0 })
    expect(stores.queries.query(5).currentScore).toMatchObject({ score: 0.5, allRated: true, countMissingRatings: 0 })
    expect(stores.documents.query(5)).toMatchObject({ allRated: true, missingRatings: 0 })
    expect(stores.scoring.queryScore(5)).toMatchObject({ score: 0.5, allRated: true, countMissingRatings: 0 })
    expect(completed.allRated).toBe(false)
  })

  describe("query removal and targeted search", () => {
    const editable = (overrides = {}) => ({
      searchEngine: "solr",
      selectedTry: { tryNo: 2, queryParams: "q=#$query##", searchUrl: "http://solr/select" },
      createFieldSpec: () => ({ id: "id" }),
      ...overrides
    })
    const registered = (extra = {}) => ({
      queryId: 7,
      queryText: "star wars",
      ratingsStore: { createRateableDoc: (doc) => doc },
      ...extra
    })

    it("only reconciles removal of ids that are registered", () => {
      const stores = buildStores()
      const search = buildOwner({ store: stores })
      stores.queries.upsert(registered())

      expect(search.queryCapabilities.reconcileQueryRemoval(undefined)).toBe(false)
      expect(search.queryCapabilities.reconcileQueryRemoval(null)).toBe(false)
      expect(search.queryCapabilities.reconcileQueryRemoval(99)).toBe(false)
      expect(search.queryCapabilities.getQuery(7)).toBeTruthy()
      expect(search.queryCapabilities.reconcileQueryRemoval(7)).toBe(true)
      expect(search.queryCapabilities.getQuery(7)).toBeFalsy()
    })

    it("has no targeted search for an unknown query", () => {
      const search = buildOwner({ store: buildStores(), editable: editable() })
      expect(search.targetedSearch(404)).toBeNull()
    })

    it("describes the targeted search from the query and the editable settings", () => {
      const stores = buildStores()
      stores.queries.upsert(registered({ ratings: { scale: { 1: "own" } } }))
      const adapter = buildOwner({ store: stores, editable: editable() }).targetedSearch(7)

      expect(adapter).toMatchObject({ queryId: 7, queryText: "star wars", usesQueryParamsEditor: true, ratingScale: { 1: "own" } })
      // Historical Solr docFinder starts with a blank Lucene query.
      expect(adapter.initialQueryParams()).toBe("")
      const preview = buildOwner({ store: stores, editable: editable({ searchEngine: "es" }) }).targetedSearch(7)
      expect(preview.initialQueryParams()).toBe("q=star wars")

      const staticAdapter = buildOwner({ store: stores, editable: editable({ searchEngine: "static" }) }).targetedSearch(7)
      expect(staticAdapter.usesQueryParamsEditor).toBe(false)
      const algolia = buildOwner({ store: stores, editable: editable({ searchEngine: "searchapi" }) }).targetedSearch(7)
      expect(algolia.usesQueryParamsEditor).toBe(true)
      const es = buildOwner({ store: stores, editable: editable({ searchEngine: "os" }) }).targetedSearch(7)
      expect(es.usesQueryParamsEditor).toBe(true)
      const vectara = buildOwner({ store: stores, editable: editable({ searchEngine: "vectara" }) }).targetedSearch(7)
      expect(vectara.usesQueryParamsEditor).toBe(false)
    })

    it("falls back to the scorer's colors, then an empty scale, for the rating scale", () => {
      const withScorer = (query) => {
        const stores = buildStores()
        stores.queries.upsert(query)
        return buildOwner({ store: stores, editable: editable() }).targetedSearch(7).ratingScale
      }
      expect(withScorer(registered({ effectiveScorer: () => ({ getColors: () => ({ 0: "red" }) }) }))).toEqual({ 0: "red" })
      expect(withScorer(registered({ effectiveScorer: () => ({}) }))).toEqual({})
      expect(withScorer(registered({ effectiveScorer: () => null }))).toEqual({})
      expect(withScorer(registered())).toEqual({})
    })

    it("builds preview searchers with a proxy url only when the settings ask for one", async () => {
      const run = async (overrides) => {
        const stores = buildStores()
        stores.queries.upsert(registered())
        const searcher = { type: "static", docs: [], numFound: 0, search: vi.fn(() => Promise.resolve()) }
        const proxyUrlFor = vi.fn(() => "/proxy/9?url=")
        const previewArgs = vi.fn(() => Promise.resolve({ q: ["x"] }))
        const search = buildOwner({ store: stores, searcher, previewArgs, proxyUrlFor, editable: editable({ searchEngine: "es", ...overrides }) })
        await search.targetedSearch(7).search("q=x")
        return { proxyUrlFor, previewArgs, createSearcher: search.splainerSearch.searchSvc.createSearcher }
      }

      const proxied = await run({ proxyRequests: true, searchEndpointId: 9 })
      expect(proxied.proxyUrlFor).toHaveBeenCalledWith(9)
      expect(proxied.createSearcher.mock.calls[0][4].proxyUrl).toBe("/proxy/9?url=")
      expect(proxied.previewArgs).toHaveBeenCalledWith(2, "q=x")

      for (const overrides of [{ proxyRequests: false }, {}, { proxyRequests: "yes" }]) {
        const direct = await run(overrides)
        expect(direct.proxyUrlFor).not.toHaveBeenCalled()
        expect(direct.createSearcher.mock.calls[0][4].proxyUrl).toBeUndefined()
      }
    })

    describe("rated documents for mapper-based engines", () => {
      const mapperCode =
        "ratedDocsQueryParamsMapper = function (ids, idField) { return 'ids=' + ids.join(',') + '&f=' + idField }"
      const searchApi = (selectedTry = {}) =>
        editable({
          searchEngine: "searchapi",
          mapperCode,
          selectedTry: {
            tryNo: 3,
            searchEngine: "searchapi",
            mapperCode,
            mapperBasedSearchEngineSupportsRatedDocsLookup: true,
            ...selectedTry
          }
        })

      const run = async ({ settings = searchApi(), previewArgs }) => {
        const stores = buildStores()
        stores.queries.upsert(registered({ ratings: { a: 1, b: 2 } }))
        const searcher = {
          type: "searchapi",
          docs: [{ id: "a" }],
          numFound: 1,
          search: vi.fn(() => Promise.resolve())
        }
        const search = buildOwner({ store: stores, searcher, previewArgs, editable: settings })
        const adapter = await search.targetedSearch(7).resetToRated()
        return { adapter, searcher, previewArgs, createSearcher: search.splainerSearch.searchSvc.createSearcher }
      }

      it("looks up rated docs through the mapper and forces POST", async () => {
        const previewArgs = vi.fn(() => Promise.resolve({ q: "resolved" }))
        const { adapter, createSearcher } = await run({ previewArgs })

        expect(previewArgs).toHaveBeenCalledWith(3, "ids=a,b&f=id")
        const lookupCall = createSearcher.mock.calls[createSearcher.mock.calls.length - 1]
        expect(lookupCall[2]).toEqual({ q: "resolved" })
        expect(lookupCall[4].apiMethod).toBe("POST")
        expect(adapter.docs.map((doc) => doc.id)).toEqual(["a"])
      })

      it("leaves the list empty when the mapper builds no query or the args cannot be resolved", async () => {
        const noMapper = vi.fn(() => Promise.resolve({}))
        const without = await run({ settings: searchApi({ mapperCode: "x = 1" }), previewArgs: noMapper })
        expect(noMapper).not.toHaveBeenCalled()
        expect(without.adapter.docs).toEqual([])

        const unresolved = vi.fn(() => Promise.resolve(null))
        const none = await run({ previewArgs: unresolved })
        expect(unresolved).toHaveBeenCalled()
        expect(none.adapter.docs).toEqual([])
        expect(none.searcher.search).not.toHaveBeenCalled()
      })
    })
  })
})
