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
})
