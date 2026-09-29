import { describe, expect, it, vi } from "vitest"
import { QueryCollectionStore } from "stores/query_collection_store"
import { createLiveQueryRegistry } from "utils/live_query_registry"

function storeFor() {
  const store = new QueryCollectionStore()
  vi.spyOn(store, "upsert")
  vi.spyOn(store, "remove")
  vi.spyOn(store, "reset")
  return store
}

describe("createLiveQueryRegistry", () => {
  it("registers live objects and publishes persisted collection changes", () => {
    const store = storeFor()
    const registry = createLiveQueryRegistry({ store })
    const query = { queryId: 2 }

    registry.register(2, query)

    expect(registry.get(2)).toBe(query)
    expect(store.upsert).toHaveBeenCalledWith(query, { publish: true })
  })

  it("supports bootstrap registration without publishing partial collection state", () => {
    const store = storeFor()
    const registry = createLiveQueryRegistry({ store })
    const query = { queryId: 1 }

    registry.register(1, query, { publish: false })

    expect(registry.get(1)).toBe(query)
    expect(store.upsert).toHaveBeenCalledWith(query, { publish: false })
  })

  it("uses the collection store as the live object owner", () => {
    const store = new QueryCollectionStore()
    const registry = createLiveQueryRegistry({ store })
    const query = { queryId: 1 }

    registry.register(1, query, { publish: false })

    expect(store.liveQuery(1)).toBe(query)
    expect(registry.get(1)).toBe(query)

    registry.clear()

    expect(store.liveQuery(1)).toBeNull()
  })

  it("preserves registered live objects when bootstrap replaces snapshots", () => {
    const store = new QueryCollectionStore()
    const registry = createLiveQueryRegistry({ store })
    const query = { queryId: 1, queryText: "live" }

    registry.register(1, query, { publish: false })
    store.replaceFromResponse(7, {
      display_order: [1],
      queries: [{ query_id: 1, query_text: "snapshot" }]
    })

    expect(registry.get(1)).toBe(query)
    expect(registry.all()).toEqual({ 1: query })
    expect(store.query(1).queryText).toBe("snapshot")
  })

  it("enumerates live objects in store order and removes them together", () => {
    const store = storeFor()
    const registry = createLiveQueryRegistry({ store })
    const first = { queryId: 1 }
    const second = { queryId: 2 }
    registry.register(1, first, { publish: false })
    registry.register(2, second, { publish: false })
    store.setDisplayOrder([2, 1])

    expect(store.orderedQueryIds()).toEqual([2, 1])
    expect(registry.all()).toEqual({ 1: first, 2: second })
    expect(registry.remove(2)).toBe(true)
    expect(store.remove).toHaveBeenCalledWith(2)
    expect(registry.get(2)).toBeNull()
  })

  it("resets the store only for an explicit case reset", () => {
    const store = storeFor()
    const registry = createLiveQueryRegistry({ store })
    registry.register(1, { queryId: 1 }, { publish: false })

    registry.clear()
    expect(store.reset).not.toHaveBeenCalled()
    registry.clear({ resetStore: true })
    expect(store.reset).toHaveBeenCalledOnce()
  })
})
