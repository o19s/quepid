import { beforeEach, describe, expect, it } from "vitest"
import { QueryCollectionStore } from "stores/query_collection_store"

describe("QueryCollectionStore", () => {
  let store

  beforeEach(() => {
    store = new QueryCollectionStore()
  })

  it("publishes bootstrap state and preserves the server display order", () => {
    const changes = []
    store.addEventListener("change", event => changes.push(event.detail))

    store.beginBootstrap(7)
    expect(store.status).toBe("bootstrapping")

    store.replace({
      caseId: 7,
      displayOrder: [2, 1],
      queries: [
        { query_id: 1, query_text: "first", information_need: "one" },
        { query_id: 2, query_text: "second", information_need: "two" }
      ]
    })

    expect(store.status).toBe("ready")
    expect(store.orderedQueryIds()).toEqual([2, 1])
    expect(store.query(1)).toMatchObject({ queryId: 1, queryText: "first", informationNeed: "one" })
    expect(changes).toHaveLength(2)
  })

  it("normalizes the bootstrap API response at the collection boundary", () => {
    store.beginBootstrap(7)
    store.replaceFromResponse(7, {
      display_order: [2, 1],
      queries: [
        { query_id: 1, query_text: "first" },
        { query_id: 2, query_text: "second" },
        { query_id: 3, query_text: "deleted", deleted: "true" }
      ]
    })

    expect(store.size).toBe(2)
    expect(store.orderedQueryIds()).toEqual([2, 1])
    expect(store.query(1)).toMatchObject({ queryText: "first" })
    expect(store.query(3)).toBeNull()
  })

  it("keeps the collection consistent across add, reorder, and remove", () => {
    store.replace({ caseId: 7, displayOrder: [1], queries: [{ queryId: 1, queryText: "first" }] })
    store.upsert({ queryId: 2, queryText: "second" })
    expect(store.orderedQueryIds()).toEqual([1, 2])

    store.setDisplayOrder([2, 1])
    store.remove(1)

    expect(store.orderedQueryIds()).toEqual([2])
    expect(store.query(1)).toBeNull()
  })

  it("filters deleted bootstrap rows without exposing mutable input objects", () => {
    const query = { query_id: 1, query_text: "live" }
    store.replace({
      caseId: 7,
      displayOrder: [1, 2],
      queries: [query, { query_id: 2, query_text: "gone", deleted: "true" }]
    })

    query.query_text = "changed outside the store"
    expect(store.orderedQueryIds()).toEqual([1])
    expect(store.query(1).queryText).toBe("live")
  })

  it("publishes the read-only display model from a live query without leaking methods", () => {
    const liveQuery = {
      queryId: 4,
      caseNo: 7,
      queryText: "title",
      informationNeed: "find titles",
      numFound: 12,
      ratedDocsFound: 3,
      errorText: "",
      lastScore: 0.75,
      currentScore: { score: 0.75, maxScore: 1, allRated: false, countMissingRatings: 2 },
      state: () => "loaded",
      options: { rows: 10 },
      searcher: { parsedQueryDetails: { q: "title" } },
      diffs: {}
    }

    store.upsert(liveQuery)

    expect(store.query(4)).toMatchObject({
      caseNo: 7,
      numFound: 12,
      ratedDocsFound: 3,
      lastScore: 0.75,
      currentScore: { score: 0.75, maxScore: 1, allRated: false, countMissingRatings: 2 },
      state: "loaded",
      options: { rows: 10 },
      parsedQueryDetails: { q: "title" },
      diffs: true
    })
    expect(store.query(4).state).not.toBeInstanceOf(Function)
  })

  it("preserves an early expansion toggle when the query is bootstrapped", () => {
    store.setExpanded(4, true)
    store.replace({ caseId: 7, displayOrder: [4], queries: [{ queryId: 4, queryText: "early" }] })

    expect(store.query(4).expanded).toBe(true)
  })

  it("publishes expansion changes for an existing query", () => {
    store.replace({ caseId: 7, displayOrder: [4], queries: [{ queryId: 4, queryText: "ready" }] })
    const changes = []
    store.addEventListener("change", event => changes.push(event.detail))

    store.setExpanded(4, true)

    expect(store.query(4).expanded).toBe(true)
    expect(changes.at(-1).queries["4"].expanded).toBe(true)
  })

  it("collapses every query and publishes the new display state", () => {
    store.replace({
      caseId: 7,
      displayOrder: [1, 2],
      queries: [{ queryId: 1 }, { queryId: 2 }]
    })
    store.setExpanded(1, true)
    store.setExpanded(2, true)

    store.collapseAll()

    expect(store.query(1).expanded).toBe(false)
    expect(store.query(2).expanded).toBe(false)
  })

  it("publishes query-list commands without knowing their Angular owner", () => {
    const commands = []
    store.addEventListener("command", event => commands.push(event.detail))

    store.requestToggleShowOnlyRated()
    store.requestCollapseAll()

    expect(commands).toEqual([
      { command: "toggle-show-only-rated" },
      { command: "collapse-all" }
    ])
  })

  it("tracks the search lifecycle independently from query bootstrap", () => {
    store.beginBootstrap(7)
    store.replace({ caseId: 7, displayOrder: [1], queries: [{ queryId: 1 }] })

    store.beginSearch()
    expect(store.status).toBe("ready")
    expect(store.searchStatus).toBe("searching")
    expect(store.snapshot().search).toEqual({ status: "searching", error: null })

    store.finishSearch()
    expect(store.searchStatus).toBe("ready")
    expect(store.searchError).toBe(null)
  })

  it("publishes a failed search without changing the bootstrapped collection", () => {
    const error = { status: 503, message: "search unavailable" }
    store.replace({ caseId: 7, displayOrder: [1], queries: [{ queryId: 1 }] })

    const failed = []
    store.addEventListener("search-failed", event => failed.push(event.detail))
    store.failSearch(error)

    expect(store.searchStatus).toBe("error")
    expect(store.searchError).toBe(error)
    expect(store.orderedQueryIds()).toEqual([1])
    expect(failed).toHaveLength(1)
    expect(failed[0].error).toBe(error)
    expect(failed[0].queries["1"]).toBeDefined()
  })

  it("ignores completion from an older search generation", () => {
    const firstGeneration = store.beginSearch()
    const secondGeneration = store.beginSearch()

    expect(store.finishSearch(firstGeneration)).toBe(false)
    expect(store.searchStatus).toBe("searching")
    expect(store.failSearch(new Error("stale"), firstGeneration)).toBe(false)
    expect(store.searchStatus).toBe("searching")

    expect(store.finishSearch(secondGeneration)).toBe(true)
    expect(store.searchStatus).toBe("ready")
  })
})
