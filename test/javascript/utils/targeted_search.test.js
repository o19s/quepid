import { describe, expect, it, vi } from "vitest"
import { createTargetedSearchAdapter } from "utils/query_runtime"
import { createSearcherFromSettings, settingsWithTryOverrides } from "utils/query_service"
import { createWiredServices } from "splainer-search/wired.js"

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
    supportedEngines: ["solr"],
    previewArgs: vi.fn(() => Promise.resolve({ q: "heart" })),
    settingsWithTryOverrides: vi.fn(settingsWithTryOverrides),
    createSearcherFromSettings: vi.fn(() => searcher),
    normalizeDocExplains: vi.fn(() => [{ id: "doc1" }]),
    searchApiRatedDocs: vi.fn(),
    supportsRatedDocsLookup: vi.fn(() => true),
    ...configOverrides
  }
  return { adapter: createTargetedSearchAdapter(config), config, searcher }
}

function buildSolrIntegration({ json = false, method = "GET", proxy = true } = {}) {
  const requests = []
  const respond = (url, payload, config) => {
    requests.push({ url, payload, config })
    const params = new URL(url.includes("?url=") ? url.split("?url=")[1] : url).searchParams
    const offset = Number(params.get("start") || payload?.offset || 0)
    const rows = Number(params.get("rows") || payload?.limit || 2)
    return Promise.resolve({ data: {
      response: { numFound: 5, docs: Array.from({ length: Math.min(rows, 5 - offset) }, (_, index) =>
        ({ id: `doc${offset + index}`, title: "Document" })) },
      debug: { explainOther: {} }
    } })
  }
  const client = { get: vi.fn((url, config) => respond(url, null, config)),
    post: vi.fn(respond), jsonp: vi.fn((url, config) => respond(url, null, config)) }
  const services = createWiredServices(client)
  const fieldSpec = { id: "id", title: "title", fieldList: () => ["id", "title"], highlightFieldList: () => [] }
  const settings = {
    searchEngine: "solr", apiMethod: method, proxyRequests: proxy,
    customHeaders: { "X-Search-Key": "fixture" }, basicAuthCredential: "user:fixture",
    escapeQuery: false, numberOfRows: 2,
    selectedTry: { tryNo: 1, jsonQueryParams: json,
      args: json ? { query: "#$query##", limit: 2 } : { q: ["#$query##"], rows: ["2"] },
      searchUrl: "https://solr.test/select" },
    createFieldSpec: () => fieldSpec
  }
  const query = { queryText: "heart", options: {}, ratings: {} }
  const adapter = createTargetedSearchAdapter({
    query, queryId: 7, settings, selectedTry: settings.selectedTry, supportedEngines: ["solr"],
    settingsWithTryOverrides,
    createSearcherFromSettings: (currentSettings, currentQuery) => createSearcherFromSettings({
      settings: currentSettings, query: currentQuery, proxyUrl: "https://quepid.test/proxy/1?url=",
      createSearcher: (...args) => services.createSearcher(...args)
    }),
    normalizeDocExplains: (_query, searcher) => searcher.docs.map((doc) => ({ id: doc.id }))
  })
  return { adapter, client, requests }
}

describe("Solr finder request integration", () => {
  it.each(["GET", "POST"])("preserves %s proxy and credentials for both requests", async (method) => {
    const { adapter, client, requests } = buildSolrIntegration({ method })
    await adapter.search("id:*")
    expect(requests).toHaveLength(2)
    expect(client.jsonp).not.toHaveBeenCalled()
    expect(client[method.toLowerCase()]).toHaveBeenCalledTimes(2)
    for (const request of requests) {
      expect(request.url).toMatch(/^https:\/\/quepid.test\/proxy\/1\?url=/)
      expect(request.config.headers).toMatchObject({ "X-Search-Key": "fixture", Authorization: "Basic dXNlcjpmaXh0dXJl" })
    }
  })

  it.each([false, true])("pages finder documents with the configured limit and proxy (JSON DSL: %s)", async (json) => {
    const { adapter, requests, client } = buildSolrIntegration({ json, method: "POST" })
    await adapter.search("id:*")
    expect(adapter.docs.map((doc) => doc.id)).toEqual(["doc0", "doc1"])
    await adapter.paginate()
    expect(adapter.docs.map((doc) => doc.id)).toEqual(["doc0", "doc1", "doc2", "doc3"])
    expect(client.jsonp).not.toHaveBeenCalled()
    if (json) expect(requests[2].payload).toMatchObject({ query: "heart", limit: 2, offset: 2 })
    else expect(new URL(requests[2].url.split("?url=")[1]).searchParams.get("q")).toBe("heart")
    expect(requests[3].url).toContain("start=2")
    expect(requests[3].url).toContain("rows=2")
    expect(requests.every((request) => request.url.startsWith("https://quepid.test/proxy/1?url="))).toBe(true)
    await adapter.paginate()
    expect(adapter.docs.map((doc) => doc.id)).toEqual(["doc0", "doc1", "doc2", "doc3", "doc4"])
    await adapter.paginate()
    expect(requests).toHaveLength(6)
  })

  it("retries a failed page without skipping results or retaining paging state", async () => {
    const { adapter, client, requests } = buildSolrIntegration({ json: true, method: "POST" })
    await adapter.search("id:*")
    client.post.mockRejectedValueOnce(new Error("offline"))
    await expect(adapter.paginate()).rejects.toThrow("offline")
    expect(adapter.paging).toBe(false)
    expect(adapter.docs.map((doc) => doc.id)).toEqual(["doc0", "doc1"])
    await adapter.paginate()
    expect(requests[2].payload.offset).toBe(2)
    expect(adapter.docs.map((doc) => doc.id)).toEqual(["doc0", "doc1", "doc2", "doc3"])
  })

  it("retains direct JSONP for an existing unproxied classic endpoint", async () => {
    const { adapter, client } = buildSolrIntegration({ method: "JSONP", proxy: false })
    await adapter.search("id:*")
    expect(client.jsonp).toHaveBeenCalledTimes(2)
    expect(adapter.docs.map((doc) => doc.id)).toEqual(["doc0", "doc1"])
  })
})

describe("targeted search adapter", () => {
  it("accepts a plain Solr finder query and explains against the original query", async () => {
    const { adapter, config, searcher } = buildAdapter()
    expect(adapter.initialQueryParams()).toBe("")

    await adapter.search("id:l_15577")

    expect(config.previewArgs).not.toHaveBeenCalled()
    expect(config.createSearcherFromSettings).toHaveBeenCalledWith(
      expect.objectContaining({ selectedTry: expect.objectContaining({ args: expect.objectContaining({
        explainOther: ["id:l_15577"]
      }) }) }), config.query
    )
    expect(searcher.explainOther).not.toHaveBeenCalled()
    expect(searcher.search).toHaveBeenCalledTimes(2)
    expect(adapter.docs).toEqual([{ id: "doc1" }])
    expect(adapter).toMatchObject({ lastQuery: "id:l_15577", numFound: 1, parseError: false })
  })

  it("pages Solr finder results with the same explain query and recovers after a failed search", async () => {
    const { adapter, config, searcher } = buildAdapter({
      settings: { numberOfRows: 1 }, searcher: { numFound: 5 },
      normalizeDocExplains: vi.fn().mockReturnValueOnce([{ id: "doc1" }]).mockReturnValueOnce([{ id: "doc2" }])
    })
    searcher.search.mockRejectedValueOnce(new Error("offline"))
    await expect(adapter.search("id:l_15577")).rejects.toThrow("offline")
    await adapter.search("id:l_15577")
    await adapter.paginate()

    expect(config.createSearcherFromSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({ selectedTry: expect.objectContaining({ args: expect.objectContaining({
        q: ["id:l_15577"], start: ["1"]
      }) }) }), config.query
    )
    expect(adapter.docs).toEqual([{ id: "doc1" }, { id: "doc2" }])
    expect(adapter).toMatchObject({ numFound: 5, paging: false })
  })
  it("prefers the injected rating scale (scorer colors) over the query's own scale, which is the fallback", () => {
    const scale = { 0: { color: "red" }, 1: { color: "green" } }

    expect(buildAdapter({ ratingScale: scale }).adapter.ratingScale).toBe(scale)
    expect(buildAdapter().adapter.ratingScale).toEqual({ 1: "Not relevant" })
  })

  it("runs a preview search through injected engine dependencies", async () => {
    const { adapter, config, searcher } = buildAdapter({ settings: { searchEngine: "es" }, searcher: { type: "es" } })

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
      settings: { searchEngine: "es" },
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
    const { adapter } = buildAdapter({ settings: { searchEngine: "es" }, selectedTry: { queryParams: "q=#$query##&pf=#$query##" } })

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
    const nextSearcher = { type: "es", numFound: 5, search: vi.fn(() => Promise.resolve()), pager: () => null }
    const { adapter, searcher } = buildAdapter({
      settings: { searchEngine: "es" }, searcher: { type: "es" },
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

  it("rates every listed document in bulk, or clears them all", async () => {
    const first = {
      id: 1,
      rateBulk: vi.fn(() => Promise.resolve()),
      resetBulkRatings: vi.fn(() => Promise.resolve())
    }
    const { adapter, config } = buildAdapter()

    await expect(adapter.rateAll("2")).resolves.toBe(true)
    expect(config.query.touchModifiedAt).not.toHaveBeenCalled()

    adapter.docs = [first, { id: 2 }]
    await adapter.rateAll("2")
    await adapter.rateAll(null)

    expect(first.rateBulk).toHaveBeenCalledWith([1, 2], 2)
    expect(first.resetBulkRatings).toHaveBeenCalledWith([1, 2])
    expect(config.query.touchModifiedAt).toHaveBeenCalledTimes(2)
  })

  it("clears a single rating, and ignores documents that aren't listed", async () => {
    const doc = { id: 7, rate: vi.fn(() => Promise.resolve()), resetRating: vi.fn(() => Promise.resolve()) }
    const { adapter, config } = buildAdapter()
    adapter.docs = [doc]

    await expect(adapter.rate("7", null)).resolves.toBe(true)
    expect(doc.resetRating).toHaveBeenCalledOnce()
    await expect(adapter.rate("missing", 1)).resolves.toBe(false)
    expect(config.query.touchModifiedAt).toHaveBeenCalledOnce()
  })

  it("mutates live rateable documents through the adapter", async () => {
    const doc = { id: "doc1", rate: vi.fn(() => Promise.resolve()), resetRating: vi.fn(() => Promise.resolve()) }
    const { adapter, config } = buildAdapter()
    adapter.docs = [doc]

    await expect(adapter.rate("doc1", "3")).resolves.toBe(true)
    expect(doc.rate).toHaveBeenCalledWith(3)
    expect(config.query.touchModifiedAt).toHaveBeenCalledOnce()
  })

  it("touches the query only after the rating request resolves", async () => {
    let resolveRating
    const doc = { id: "doc1", rate: vi.fn(() => new Promise((resolve) => { resolveRating = resolve })) }
    const { adapter, config } = buildAdapter()
    adapter.docs = [doc]

    const rated = adapter.rate("doc1", "1")
    expect(config.query.touchModifiedAt).not.toHaveBeenCalled()

    resolveRating()
    await expect(rated).resolves.toBe(true)
    expect(config.query.touchModifiedAt).toHaveBeenCalledOnce()
  })
})
