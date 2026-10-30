import { describe, expect, it, vi } from "vitest"
import {
  buildSearcherRequest,
  buildSearchApiRatedDocsQueryParams,
  createSearcherFromSettings,
  evaluateMapperFunctions,
  findUnresolvedQOptionPlaceholder,
  matchFeaturesExplain,
  QueryNotReadyError,
  normalizeSearchResults,
  pAll,
  runSearchAll,
  settingsWithTryOverrides
} from "utils/query_service"

describe("query service helpers", () => {
  it("creates a searcher through injected infrastructure and preserves static normalization", () => {
    const createSearcher = vi.fn(() => ({ type: "solr" }))
    const settings = {
      searchEngine: "static",
      selectedTry: {
        args: { q: "#$query##" },
        jsonQueryParams: false,
        searchUrl: "https://search.test"
      },
      createFieldSpec: () => ({ id: "id" }),
      options: {},
      proxyRequests: false
    }
    const query = { queryText: "books", options: { boost: 2 }, filterToRatings: vi.fn() }

    const searcher = createSearcherFromSettings({
      settings,
      query,
      evaluateMapper: vi.fn(),
      createSearcher
    })

    expect(searcher).toEqual({ type: "solr" })
    expect(settings.searchEngine).toBe("solr")
    expect(createSearcher).toHaveBeenCalledWith(
      { id: "id" },
      "https://search.test",
      { q: "#$query##", echoParams: "all" },
      "books",
      expect.objectContaining({ qOption: { boost: 2 } }),
      "solr"
    )
  })

  it("creates a WarpSearch searcher as OpenSearch without changing the try's engine", () => {
    const createSearcher = vi.fn(() => ({ type: "os" }))
    const filterToRatings = vi.fn(() => ({ terms: { _id: ["1"] } }))
    const settings = {
      searchEngine: "warpsearch",
      selectedTry: {
        args: { query: "books" },
        searchUrl: "https://api.warpsearch.io/compat/opensearch/books/_search"
      },
      createFieldSpec: () => ({ id: "_id" })
    }
    const query = { queryText: "books", options: {}, filterToRatings }

    createSearcherFromSettings({
      settings,
      query,
      options: { filterToRated: true },
      isEsOrOs: true,
      evaluateMapper: vi.fn(),
      createSearcher
    })

    expect(settings.searchEngine).toBe("warpsearch")
    expect(createSearcher.mock.calls[0][2]).toEqual({
      query: { bool: { should: "books", filter: { terms: { _id: ["1"] } } } }
    })
    expect(createSearcher.mock.calls[0][5]).toBe("os")
  })

  it("passes rated filters to the framework-free searcher boundary", () => {
    const createSearcher = vi.fn(() => ({ type: "es" }))
    const filterToRatings = vi.fn(() => ({ terms: { id: ["1"] } }))
    const settings = {
      searchEngine: "es",
      selectedTry: { args: { query: "books" }, searchUrl: "https://search.test" },
      createFieldSpec: () => ({ id: "id" })
    }
    const query = { queryText: "books", options: {}, filterToRatings }

    createSearcherFromSettings({
      settings,
      query,
      options: { filterToRated: true },
      isEsOrOs: true,
      evaluateMapper: vi.fn(),
      createSearcher
    })

    expect(filterToRatings).toHaveBeenCalledWith(settings)
    expect(createSearcher.mock.calls[0][2]).toEqual({
      query: { bool: { should: "books", filter: { terms: { id: ["1"] } } } }
    })
  })

  it("builds classic Solr requests with rating filters and query options", () => {
    const settings = {
      searchEngine: "solr",
      selectedTry: { args: { q: "#$query##", fq: "type:movie" }, jsonQueryParams: false },
      options: { boost: 1 },
      customHeaders: { "X-Test": "yes" },
      numberOfRows: 20,
      escapeQuery: true,
      apiMethod: "GET"
    }

    const result = buildSearcherRequest({
      settings,
      queryText: "star wars",
      queryOptions: { tie: 0.1 },
      options: { filterToRated: true },
      ratingsFilter: "{!terms f=id}42",
      mapperFunctions: {}
    })

    expect(result.args).toEqual({
      q: "#$query##",
      fq: ["type:movie", "{!terms f=id}42"],
      echoParams: "all"
    })
    expect(result.searchEngine).toBe("solr")
    expect(result.searcherOptions).toMatchObject({
      customHeaders: '{"X-Test":"yes"}',
      qOption: { boost: 1, tie: 0.1 },
      jsonQueryDsl: false
    })
    expect(settings.selectedTry.args).toEqual({ q: "#$query##", fq: "type:movie" })
  })

  it("uses ES filters and preserves mapper search options", () => {
    const result = buildSearcherRequest({
      settings: {
        searchEngine: "es",
        selectedTry: {
          args: { query: "test" },
          mapperBasedSearchEnginePaginationHitsParam: "limit",
          mapperBasedSearchEnginePaginationOffsetParam: "offset"
        },
        options: {}
      },
      queryText: "test",
      options: { forceApiMethod: "POST", filterToRated: true },
      ratingsFilter: { term: { id: "42" } },
      isEsOrOs: true
    })

    expect(result.searchEngine).toBe("es")
    expect(result.args).toEqual({
      query: { bool: { should: "test", filter: { term: { id: "42" } } } }
    })
    expect(result.searcherOptions).toMatchObject({ apiMethod: "POST" })
  })

  it("preserves mapper search options", () => {
    const result = buildSearcherRequest({
      settings: {
        searchEngine: "searchapi",
        selectedTry: {
          args: { query: "test" },
          mapperBasedSearchEnginePaginationHitsParam: "limit",
          mapperBasedSearchEnginePaginationOffsetParam: "offset"
        }
      },
      queryText: "test",
      mapperFunctions: {
        docsMapper: () => [],
        numberOfResultsMapper: () => 1,
        nextPageArgsMapper: () => ({})
      },
      options: { forceApiMethod: "POST" }
    })

    expect(result.searcherOptions).toMatchObject({
      apiMethod: "POST",
      docsMapper: expect.any(Function),
      numberOfResultsMapper: expect.any(Function),
      nextPageArgsMapper: expect.any(Function),
      paginationHitsParam: "limit",
      paginationOffsetParam: "offset"
    })
  })

  it("normalizes static settings to the Solr request shape", () => {
    const result = buildSearcherRequest({
      settings: {
        searchEngine: "static",
        selectedTry: { args: { q: "test" }, jsonQueryParams: false }
      },
      queryText: "test"
    })

    expect(result.searchEngine).toBe("solr")
    expect(result.searcherOptions.jsonQueryDsl).toBe(false)
  })

  it("overlays selected try settings without mutating either input", () => {
    const settings = { selectedTry: { searchEngine: "solr", args: { q: "old" } }, numberOfRows: 10 }
    const result = settingsWithTryOverrides(settings, { args: { q: "new" } })

    expect(result).toEqual({
      selectedTry: { searchEngine: "solr", args: { q: "new" } },
      numberOfRows: 10
    })
    expect(settings.selectedTry.args.q).toBe("old")
  })

  it("evaluates mapper code once per cache key and exposes recognized functions", () => {
    const cache = {}
    const globalObject = {}
    const code = "this.docsMapper = function (docs) { return docs }"

    const first = evaluateMapperFunctions(code, cache, globalObject)
    const second = evaluateMapperFunctions(code, cache, globalObject)

    expect(first.docsMapper).toBeTypeOf("function")
    expect(first.numberOfResultsMapper).toBeUndefined()
    expect(second).toBe(first)
  })

  it("builds the synthetic match-feature explain tree", () => {
    expect(
      matchFeaturesExplain({ fields: { score: 4 }, matchfeatures: { title: 3, body: 1 } })
    ).toEqual({
      description: "sum of matched fields:",
      value: 4,
      details: [
        { description: "title", value: 3, details: [] },
        { description: "body", value: 1, details: [] }
      ]
    })
    expect(matchFeaturesExplain({ matchfeatures: {} })).toBeUndefined()
  })

  it("builds rated-document mapper params through the shared mapper seam", () => {
    const evaluateMapper = vi.fn(() => ({
      ratedDocsQueryParamsMapper: (ids, idField) => `${idField}:${ids.join(",")}`
    }))

    expect(buildSearchApiRatedDocsQueryParams("mapper", ["a", "b"], "doc_id", evaluateMapper)).toBe(
      "doc_id:a,b"
    )
    expect(evaluateMapper).toHaveBeenCalledWith("mapper")
  })

  it("normalizes searchapi documents into rateable documents", () => {
    const createNormalDoc = vi.fn((fieldSpec, doc, explain) => ({ fieldSpec, doc, explain }))
    const createRateableDoc = vi.fn((doc) => ({ ...doc, rateable: true }))
    const searcher = {
      type: "searchapi",
      docs: [{ id: "1", matchfeatures: { title: 2 }, fields: { score: 2 } }]
    }

    expect(
      normalizeSearchResults({
        searcher,
        fieldSpec: { id: "id" },
        extractors: { es: vi.fn(), solr: vi.fn() },
        createNormalDoc,
        createRateableDoc
      })
    ).toEqual([
      {
        fieldSpec: { id: "id" },
        doc: searcher.docs[0],
        explain: {
          description: "sum of matched fields:",
          value: 2,
          details: [{ description: "title", value: 2, details: [] }]
        },
        rateable: true
      }
    ])
  })

  it("runs an unrestricted queue with bounded concurrency", async () => {
    const calls = []
    const queue = Array.from({ length: 12 }, (_, index) => async () => {
      calls.push(index)
      return index
    })

    await expect(pAll(queue, 0)).resolves.toEqual([...Array(12).keys()])
    expect(calls).toHaveLength(12)
  })

  it("runs a rate-limited queue sequentially, one task per interval", async () => {
    vi.useFakeTimers()
    try {
      const calls = []
      // 60 requests per minute: one task every 1000 ms.
      const promise = pAll(
        [async () => calls.push(1), async () => calls.push(2), async () => calls.push(3)],
        60
      )

      await vi.advanceTimersByTimeAsync(0)
      expect(calls).toEqual([1])
      await vi.advanceTimersByTimeAsync(999)
      expect(calls).toEqual([1])
      await vi.advanceTimersByTimeAsync(1)
      expect(calls).toEqual([1, 2])
      await vi.advanceTimersByTimeAsync(1000)
      expect(calls).toEqual([1, 2, 3])
      await expect(promise).resolves.toEqual([1, 2, 3])
    } finally {
      vi.useRealTimers()
    }
  })

  it("drains a failing batch without exceeding ten concurrent tasks or rejecting early", async () => {
    const error = new Error("search failed")
    const calls = []
    const releases = []
    let active = 0
    let peak = 0
    const queue = Array.from({ length: 23 }, (_, index) => async () => {
      calls.push(index)
      active++
      peak = Math.max(peak, active)
      await new Promise((resolve) => releases.push(resolve))
      active--
      if (index < 10) throw error
      return index
    })
    const settled = vi.fn()
    const batch = pAll(queue, 0).then(settled, (failure) => settled(failure))

    expect(calls).toHaveLength(10)
    for (let wave = 0; wave < 3; wave++) {
      expect(settled).not.toHaveBeenCalled()
      releases.splice(0).forEach((release) => release())
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
    await batch

    expect(calls).toEqual([...Array(23).keys()])
    expect(peak).toBe(10)
    expect(active).toBe(0)
    expect(settled).toHaveBeenCalledExactlyOnceWith(error)
  })

  it("continues past synchronous throws and reports the failure after draining", async () => {
    const error = new Error("invalid search")
    const next = vi.fn(() => 2)
    await expect(
      pAll(
        [
          () => {
            throw error
          },
          next
        ],
        0
      )
    ).rejects.toBe(error)
    expect(next).toHaveBeenCalledOnce()
  })

  it("preserves rate limiting after a failed request", async () => {
    vi.useFakeTimers()
    try {
      const error = new Error("search failed")
      const calls = []
      const batch = pAll(
        [
          async () => {
            calls.push(Date.now())
            throw error
          },
          async () => calls.push(Date.now()),
          async () => calls.push(Date.now())
        ],
        60
      )
      // eslint-disable-next-line vitest/valid-expect -- awaited after the timers advance
      const result = expect(batch).rejects.toBe(error)

      await vi.advanceTimersByTimeAsync(999)
      expect(calls).toHaveLength(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(calls).toHaveLength(2)
      await vi.advanceTimersByTimeAsync(1000)
      await result
      expect(calls.map((time) => time - calls[0])).toEqual([0, 1000, 2000])
    } finally {
      vi.useRealTimers()
    }
  })

  it("runs the live search batch, scores queries, aggregates, and completes the read model", async () => {
    const events = []
    const queries = { first: { id: 1 }, second: { id: 2 } }
    const search = vi.fn(async (query) => events.push(`search:${query.id}`))
    const score = vi.fn(async (query) => events.push(`score:${query.id}`))
    const scoreAll = vi.fn(async () => events.push("scoreAll"))
    const syncToBook = vi.fn(() => events.push("sync"))

    await runSearchAll({
      queries,
      search,
      score,
      requestsPerMinute: 0,
      scoreAll,
      syncToBook,
      onSearchStarted: () => {
        events.push("started")
        return 7
      },
      onSearchCompleted: (generation) => events.push(`completed:${generation}`),
      onSearchFailed: vi.fn(),
      logger: { info: vi.fn() }
    })

    expect(search).toHaveBeenCalledTimes(2)
    expect(score).toHaveBeenCalledTimes(2)
    expect(scoreAll).toHaveBeenCalledOnce()
    expect(syncToBook).toHaveBeenCalledOnce()
    expect(events).toEqual([
      "started",
      "search:1",
      "search:2",
      "score:1",
      "score:2",
      "scoreAll",
      "sync",
      "completed:7"
    ])
  })

  it("reports search, aggregation, and book-sync failures through one failure seam", async () => {
    const onSearchFailed = vi.fn()
    const error = new Error("search failed")

    await expect(
      runSearchAll({
        queries: { first: { id: 1 } },
        search: vi.fn().mockRejectedValue(error),
        score: vi.fn(),
        requestsPerMinute: 0,
        scoreAll: vi.fn(),
        syncToBook: vi.fn(),
        onSearchStarted: () => 3,
        onSearchCompleted: vi.fn(),
        onSearchFailed,
        logger: { info: vi.fn() }
      })
    ).rejects.toBe(error)

    expect(onSearchFailed).toHaveBeenCalledWith(error, 3)
    expect(onSearchFailed).toHaveBeenCalledOnce()
  })
  it("waits for book submission and reports its asynchronous failure before completing", async () => {
    let rejectSync
    const submission = new Promise((_, reject) => {
      rejectSync = reject
    })
    const onSearchCompleted = vi.fn()
    const onSearchFailed = vi.fn()
    const syncToBook = vi.fn(() => submission)
    const result = runSearchAll({
      queries: {},
      search: vi.fn(),
      score: vi.fn(),
      scoreAll: vi.fn(() => "scores"),
      syncToBook,
      onSearchStarted: () => 3,
      onSearchCompleted,
      onSearchFailed
    })
    const error = new Error("Book auto-sync failed")
    // eslint-disable-next-line vitest/valid-expect -- awaited once the sync has run
    const failure = expect(result).rejects.toBe(error)
    await vi.waitFor(() => expect(syncToBook).toHaveBeenCalledOnce())
    expect(onSearchCompleted).not.toHaveBeenCalled()
    rejectSync(error)
    await failure
    expect(onSearchFailed).toHaveBeenCalledExactlyOnceWith(error, 3)
    expect(onSearchCompleted).not.toHaveBeenCalled()
  })

  it("returns scores only after the book submission is acknowledged", async () => {
    let acknowledge
    const submission = new Promise((resolve) => {
      acknowledge = resolve
    })
    const syncToBook = vi.fn(() => submission)
    const onSearchCompleted = vi.fn()
    const scores = { score: 0.5 }
    const result = runSearchAll({
      queries: {},
      search: vi.fn(),
      score: vi.fn(),
      scoreAll: () => scores,
      syncToBook,
      onSearchStarted: () => 4,
      onSearchCompleted
    })
    await vi.waitFor(() => expect(syncToBook).toHaveBeenCalledOnce())
    expect(onSearchCompleted).not.toHaveBeenCalled()
    acknowledge()
    await expect(result).resolves.toBe(scores)
    expect(onSearchCompleted).toHaveBeenCalledExactlyOnceWith(4)
  })

  describe("searcher option branches", () => {
    const build = (settings = {}, extra = {}) =>
      buildSearcherRequest({
        settings: {
          searchEngine: "solr",
          selectedTry: { args: { q: ["#$query##"] }, jsonQueryParams: false },
          ...settings
        },
        queryText: "books",
        ...extra
      })

    it("passes apiMethod only when the settings define one", () => {
      expect(build({ apiMethod: "POST" }).searcherOptions.apiMethod).toBe("POST")
      expect(build().searcherOptions).not.toHaveProperty("apiMethod")
      expect(
        build({ apiMethod: "POST" }, { options: { forceApiMethod: "GET" } }).searcherOptions
          .apiMethod
      ).toBe("GET")
    })

    it("sets the proxy url only when proxyRequests is exactly true", () => {
      expect(build({ proxyRequests: true }, { proxyUrl: "/proxy" }).searcherOptions.proxyUrl).toBe(
        "/proxy"
      )
      expect(
        build({ proxyRequests: false }, { proxyUrl: "/proxy" }).searcherOptions
      ).not.toHaveProperty("proxyUrl")
      expect(build({}, { proxyUrl: "/proxy" }).searcherOptions).not.toHaveProperty("proxyUrl")
    })

    it("stringifies object custom headers and leaves strings and null alone", () => {
      expect(build({ customHeaders: { a: "1" } }).searcherOptions.customHeaders).toBe('{"a":"1"}')
      expect(build({ customHeaders: '{"a":"1"}' }).searcherOptions.customHeaders).toBe('{"a":"1"}')
      expect(build({ customHeaders: null }).searcherOptions.customHeaders).toBeNull()
    })

    it("infers JSON query params for Solr from the shape of args when not explicit", () => {
      const infer = (args) => build({ selectedTry: { args } }).solrQueryParamsIsJson
      expect(infer({ q: ["a"], fq: ["b"] })).toBe(false)
      expect(infer({ q: ["a"], fq: "b" })).toBe(true)
      expect(infer({ query: "a" })).toBe(true)
      expect(
        build({ selectedTry: { args: { query: "a" }, jsonQueryParams: false } })
          .solrQueryParamsIsJson
      ).toBe(false)
    })

    it("adds the rating filter only when filterToRated and a filter are both present", () => {
      const filtered = (filterToRated, ratingsFilter) =>
        build({}, { options: { filterToRated }, ratingsFilter }).args
      expect(filtered(true, "id:1").fq).toEqual(["id:1"])
      expect(filtered(false, "id:1")).not.toHaveProperty("fq")
      expect(filtered(true, undefined)).not.toHaveProperty("fq")
    })
  })

  describe("createSearcherFromSettings mapper evaluation", () => {
    const settings = (searchEngine) => ({
      searchEngine,
      mapperCode: "code",
      selectedTry: { args: { q: "x" }, searchUrl: "u" },
      createFieldSpec: () => ({})
    })
    const query = { queryText: "q", options: {}, filterToRatings: vi.fn() }

    it("evaluates mapper code for searchapi engines and applies the mappers", () => {
      const docsMapper = vi.fn()
      const evaluateMapper = vi.fn(() => ({ docsMapper }))
      const createSearcher = vi.fn()
      createSearcherFromSettings({
        settings: settings("searchapi"),
        query,
        evaluateMapper,
        createSearcher
      })
      expect(evaluateMapper).toHaveBeenCalledWith("code")
      expect(createSearcher.mock.calls[0][4].docsMapper).toBe(docsMapper)
    })

    it("does not evaluate mapper code for other engines", () => {
      const evaluateMapper = vi.fn(() => ({}))
      createSearcherFromSettings({
        settings: settings("solr"),
        query,
        evaluateMapper,
        createSearcher: vi.fn()
      })
      expect(evaluateMapper).not.toHaveBeenCalled()
    })
  })

  describe("rate limit boundaries", () => {
    it("treats zero and negative rates as unlimited, running tasks concurrently", async () => {
      for (const rate of [0, -5, undefined]) {
        let running = 0
        let peak = 0
        const task = async () => {
          running += 1
          peak = Math.max(peak, running)
          await new Promise((resolve) => setTimeout(resolve, 1))
          running -= 1
        }
        await pAll([task, task, task], rate)
        expect(peak).toBeGreaterThan(1)
      }
    })

    it("logs the rate limit only for positive rates", () => {
      const run = (requestsPerMinute) => {
        const logger = { info: vi.fn() }
        runSearchAll({
          queries: {},
          search: vi.fn(),
          score: vi.fn(),
          requestsPerMinute,
          scoreAll: vi.fn(),
          syncToBook: vi.fn(),
          logger
        })
        return logger.info
      }
      expect(run(30)).toHaveBeenCalledWith("Rate limited to 30 requests per minute.")
      expect(run(0)).not.toHaveBeenCalled()
      expect(run(-1)).not.toHaveBeenCalled()
    })
  })
})

describe("createSearcherFromSettings mapper evaluation", () => {
  const settings = (searchEngine) => ({
    searchEngine,
    mapperCode: "code",
    selectedTry: { args: { q: "x" }, searchUrl: "u" },
    createFieldSpec: () => ({})
  })
  const query = { queryText: "q", options: {}, filterToRatings: vi.fn() }

  it("evaluates mapper code for searchapi engines and applies the mappers", () => {
    const docsMapper = vi.fn()
    const evaluateMapper = vi.fn(() => ({ docsMapper }))
    const createSearcher = vi.fn()
    createSearcherFromSettings({
      settings: settings("searchapi"),
      query,
      evaluateMapper,
      createSearcher
    })
    expect(evaluateMapper).toHaveBeenCalledWith("code")
    expect(createSearcher.mock.calls[0][4].docsMapper).toBe(docsMapper)
  })

  it("does not evaluate mapper code for other engines", () => {
    const evaluateMapper = vi.fn(() => ({}))
    createSearcherFromSettings({
      settings: settings("solr"),
      query,
      evaluateMapper,
      createSearcher: vi.fn()
    })
    expect(evaluateMapper).not.toHaveBeenCalled()
  })
})

describe("findUnresolvedQOptionPlaceholder", () => {
  it("finds a whole-string qOption placeholder with no value", () => {
    const template = { query: { nearest: "#$qOption.query_vec##" }, limit: 10 }
    expect(findUnresolvedQOptionPlaceholder(template, {})).toBe("query_vec")
  })

  it("finds one nested inside an array", () => {
    const template = ["#$query##", { nearest: "#$qOption.query_vec##" }]
    expect(findUnresolvedQOptionPlaceholder(template, {})).toBe("query_vec")
  })

  it("resolves a nested dotted path", () => {
    const template = { vector: "#$qOption.embedding.values##" }
    const qOption = { embedding: { values: [0.1, 0.2] } }
    expect(findUnresolvedQOptionPlaceholder(template, qOption)).toBeUndefined()
  })

  it("does not flag a placeholder with a default", () => {
    const template = { nearest: "#$qOption.query_vec|[]##" }
    expect(findUnresolvedQOptionPlaceholder(template, {})).toBeUndefined()
  })

  it("ignores a placeholder embedded inside a longer string", () => {
    const template = { f: "vec:[#$qOption.query_vec##]" }
    expect(findUnresolvedQOptionPlaceholder(template, {})).toBeUndefined()
  })

  it("passes once the query has a vector", () => {
    const template = { query: { nearest: "#$qOption.query_vec##" } }
    expect(findUnresolvedQOptionPlaceholder(template, { query_vec: [0.1, 0.2] })).toBeUndefined()
  })
})

describe("createSearcherFromSettings qOption validation", () => {
  it("throws QueryNotReadyError instead of building a searcher missing a qOption value", () => {
    const settings = {
      searchEngine: "searchapi",
      selectedTry: { args: { query: { nearest: "#$qOption.query_vec##" } }, searchUrl: "u" },
      createFieldSpec: () => ({})
    }
    const query = { queryText: "star wars", options: {}, filterToRatings: vi.fn() }
    const createSearcher = vi.fn()

    let thrown
    try {
      createSearcherFromSettings({
        settings,
        query,
        evaluateMapper: vi.fn(() => ({})),
        createSearcher
      })
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(QueryNotReadyError)
    expect(thrown.message).toBe(
      "Query template references qOption.query_vec, which isn't set for this query."
    )
    expect(createSearcher).not.toHaveBeenCalled()
  })

  it("builds the searcher once the query's options carry the referenced value", () => {
    const settings = {
      searchEngine: "searchapi",
      selectedTry: { args: { query: { nearest: "#$qOption.query_vec##" } }, searchUrl: "u" },
      createFieldSpec: () => ({})
    }
    const query = {
      queryText: "star wars",
      options: { query_vec: [0.1, 0.2] },
      filterToRatings: vi.fn()
    }
    const createSearcher = vi.fn(() => ({ type: "searchapi" }))

    expect(() =>
      createSearcherFromSettings({
        settings,
        query,
        evaluateMapper: vi.fn(() => ({})),
        createSearcher
      })
    ).not.toThrow()
    expect(createSearcher).toHaveBeenCalledOnce()
  })
})

describe("rate limit boundaries", () => {
  it("treats zero and negative rates as unlimited, running tasks concurrently", async () => {
    for (const rate of [0, -5, undefined]) {
      let running = 0
      let peak = 0
      const task = async () => {
        running += 1
        peak = Math.max(peak, running)
        await new Promise((resolve) => setTimeout(resolve, 1))
        running -= 1
      }
      await pAll([task, task, task], rate)
      expect(peak).toBeGreaterThan(1)
    }
  })

  it("logs the rate limit only for positive rates", () => {
    const run = (requestsPerMinute) => {
      const logger = { info: vi.fn() }
      runSearchAll({
        queries: {},
        search: vi.fn(),
        score: vi.fn(),
        requestsPerMinute,
        scoreAll: vi.fn(),
        syncToBook: vi.fn(),
        logger
      })
      return logger.info
    }
    expect(run(30)).toHaveBeenCalledWith("Rate limited to 30 requests per minute.")
    expect(run(0)).not.toHaveBeenCalled()
    expect(run(-1)).not.toHaveBeenCalled()
  })
})

describe("normalizeSearchResults engine dispatch", () => {
  const run = (type) => {
    const extractors = { es: vi.fn(() => [{ via: "es" }]), solr: vi.fn(() => [{ via: "solr" }]) }
    const createNormalDoc = vi.fn(() => ({ via: "normal" }))
    const result = normalizeSearchResults({
      searcher: { type, docs: [{}], othersExplained: "oe" },
      fieldSpec: {},
      extractors,
      createNormalDoc,
      createRateableDoc: (doc) => doc
    })
    return { result, extractors, createNormalDoc }
  }

  it("routes each engine type to its own extractor", () => {
    expect(run("es").result).toEqual([{ via: "es" }])
    expect(run("os").result).toEqual([{ via: "es" }])
    const solr = run("solr")
    expect(solr.result).toEqual([{ via: "solr" }])
    expect(solr.extractors.solr).toHaveBeenCalledWith([{}], {}, "oe")
    expect(solr.extractors.es).not.toHaveBeenCalled()
    const other = run("static")
    expect(other.result).toEqual([{ via: "normal" }])
    expect(other.createNormalDoc).toHaveBeenCalledWith({}, {})
    expect(other.extractors.solr).not.toHaveBeenCalled()
  })
})

describe("pAll error reporting and Solr filter wrapping", () => {
  it("rejects with the first failure when several tasks fail", async () => {
    const failing = (message) => async () => {
      throw new Error(message)
    }
    await expect(pAll([failing("first"), failing("second")], 0)).rejects.toThrow("first")
    vi.useFakeTimers()
    const promise = pAll([failing("first"), failing("second")], 60000)
    // eslint-disable-next-line vitest/valid-expect -- awaited after the timers advance
    const assertion = expect(promise).rejects.toThrow("first")
    await vi.runAllTimersAsync()
    await assertion
    vi.useRealTimers()
  })

  it("wraps an existing single Solr fq value before appending the rating filter", () => {
    const request = buildSearcherRequest({
      settings: {
        searchEngine: "solr",
        selectedTry: { args: { q: ["a"], fq: "x" }, jsonQueryParams: false }
      },
      queryText: "a",
      options: { filterToRated: true },
      ratingsFilter: "id:1"
    })
    expect(request.args.fq).toEqual(["x", "id:1"])
    const array = buildSearcherRequest({
      settings: {
        searchEngine: "solr",
        selectedTry: { args: { q: ["a"], fq: ["x"] }, jsonQueryParams: false }
      },
      queryText: "a",
      options: { filterToRated: true },
      ratingsFilter: "id:1"
    })
    expect(array.args.fq).toEqual(["x", "id:1"])
  })

  it("wraps the query in a bool filter for Elasticsearch-like engines", () => {
    const request = buildSearcherRequest({
      settings: { searchEngine: "es", selectedTry: { args: { query: { match_all: {} } } } },
      queryText: "a",
      options: { filterToRated: true },
      ratingsFilter: { ids: [1] },
      isEsOrOs: true
    })
    expect(request.args.query).toEqual({
      bool: { should: { match_all: {} }, filter: { ids: [1] } }
    })
  })
})
