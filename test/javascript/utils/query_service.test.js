import { describe, expect, it, vi } from "vitest"
import {
  buildSearcherRequest,
  buildSearchApiRatedDocsQueryParams,
  evaluateMapperFunctions,
  matchFeaturesExplain,
  normalizeSearchResults,
  pAll,
  settingsWithTryOverrides
} from "utils/query_service"

describe("query service helpers", () => {
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

    expect(result.args).toEqual({ q: "#$query##", fq: ["type:movie", "{!terms f=id}42"], echoParams: "all" })
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
      settings: { searchEngine: "static", selectedTry: { args: { q: "test" }, jsonQueryParams: false } },
      queryText: "test"
    })

    expect(result.searchEngine).toBe("solr")
    expect(result.searcherOptions.jsonQueryDsl).toBe(false)
  })

  it("overlays selected try settings without mutating either input", () => {
    const settings = { selectedTry: { searchEngine: "solr", args: { q: "old" } }, numberOfRows: 10 }
    const result = settingsWithTryOverrides(settings, { args: { q: "new" } })

    expect(result).toEqual({ selectedTry: { searchEngine: "solr", args: { q: "new" } }, numberOfRows: 10 })
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
    expect(matchFeaturesExplain({ fields: { score: 4 }, matchfeatures: { title: 3, body: 1 } })).toEqual({
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

  it("runs a rate-limited queue sequentially", async () => {
    vi.useFakeTimers()
    const calls = []
    const promise = pAll(
      [
        async () => calls.push(1),
        async () => calls.push(2),
        async () => calls.push(3)
      ],
      60000
    )

    await vi.runAllTimersAsync()
    await expect(promise).resolves.toEqual([1, 2, 3])
    expect(calls).toEqual([1, 2, 3])
    vi.useRealTimers()
  })
})
