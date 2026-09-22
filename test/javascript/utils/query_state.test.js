import { describe, expect, it } from "vitest"
import {
  invalidateRatedDocsCache,
  isImageUrl,
  matchesQueryFilter,
  orderedQueries,
  paginate,
  queryDisplayPositions,
  queryLifecycleState,
  queryResultCount,
  queryStateClass,
  querqyRuleTriggered,
  ratingChangedQueryId
} from "utils/query_state"

describe("query_state", () => {
  it("recognizes supported image URLs", () => {
    expect(isImageUrl("https://example.test/poster.JPG?size=small")).toBe(true)
    expect(isImageUrl("https://example.test/poster.txt")).toBe(false)
    expect(isImageUrl(null)).toBe(false)
  })

  it("detects both Querqy rewrite shapes", () => {
    expect(querqyRuleTriggered({ querqy: { rewrite: "title:foo" } })).toBe(true)
    expect(querqyRuleTriggered({ "querqy.infoLog": [] })).toBe(true)
    expect(querqyRuleTriggered({})).toBe(false)
    expect(querqyRuleTriggered(null)).toBe(false)
  })

  it("selects the current result count", () => {
    expect(queryResultCount({ numFound: 12, ratedDocsFound: 3 }, false)).toBe(12)
    expect(queryResultCount({ numFound: 12, ratedDocsFound: 3 }, true)).toBe(3)
  })

  it("maps query lifecycle inputs to the legacy query state", () => {
    expect(queryLifecycleState()).toBe("loading")
    expect(queryLifecycleState({ errorText: "timeout" })).toBe("error")
    expect(queryLifecycleState({ resultsReturned: true, docCount: 0 })).toBe("noResults")
    expect(queryLifecycleState({ resultsReturned: true, docCount: 2 })).toBe("loaded")
  })

  it("maps query state to the legacy header class during the bridge", () => {
    expect(queryStateClass("searching")).toBe("queryHeader_searching")
  })

  it("invalidates the rated-doc cache without discarding an in-flight request", () => {
    const promise = Promise.resolve()
    const query = { ratingsReady: true, ratingsPromise: promise, ratedDocs: [{ id: "a" }] }
    invalidateRatedDocsCache(query)
    expect(query.ratingsReady).toBe(false)
    expect(query.ratingsPromise).toBe(promise)
    expect(query.ratingsGeneration).toBe(1)
    expect(query.ratedDocs).toEqual([{ id: "a" }])
  })

  it("reads query ids from both store and Angular rating events", () => {
    expect(ratingChangedQueryId({ detail: { queryId: 7 } }, 8)).toBe(7)
    expect(ratingChangedQueryId({}, 8)).toBe(8)
  })

  it("orders queries by server display order and records their positions", () => {
    const queries = { 2: { queryId: 2 }, 1: { queryId: 1 } }
    expect(orderedQueries([1, 2, 9], queries)).toEqual([
      { queryId: 1, defaultCaseOrder: 0 },
      { queryId: 2, defaultCaseOrder: 1 }
    ])
  })

  it("matches query text case-insensitively and treats an empty filter as no filter", () => {
    expect(matchesQueryFilter({ queryText: "Star Wars" }, "war")).toBe(true)
    expect(matchesQueryFilter({ queryText: "Star Wars" }, "trek")).toBe(false)
    expect(matchesQueryFilter({ queryText: "Star Wars" }, "")).toBe(true)
  })

  it("paginates a list using one-based page numbers", () => {
    expect(paginate([1, 2, 3, 4, 5], 2, 2)).toEqual([3, 4])
  })

  it("calculates display positions across a paginated, reversible list", () => {
    expect(queryDisplayPositions({
      oldIndex: 1,
      newIndex: 0,
      currentPage: 2,
      pageSize: 15,
      reverse: false
    })).toEqual({ fromIndex: 16, toIndex: 15, reverse: true })

    expect(queryDisplayPositions({
      oldIndex: 0,
      newIndex: 1,
      currentPage: 1,
      pageSize: 15,
      reverse: true
    })).toEqual({ fromIndex: 0, toIndex: 1, reverse: true })
  })
})
