import { describe, expect, it, vi } from "vitest"
import { QueryCollectionStore } from "stores/query_collection_store"
import { createLiveQueryRegistry } from "utils/live_query_registry"

function storeFor(overrides = {}) {
  return {
    status: "ready",
    orderedQueryIds: vi.fn(() => ["q2", "q1"]),
    upsert: vi.fn(),
    remove: vi.fn(),
    reset: vi.fn(),
    ...overrides
  }
}

describe("createLiveQueryRegistry", () => {
  it("registers live objects and publishes persisted collection changes", () => {
    const store = storeFor()
    const registry = createLiveQueryRegistry({ store })
    const query = { queryId: 2 }

    registry.register(2, query)

    expect(registry.get(2)).toBe(query)
    expect(store.upsert).toHaveBeenCalledWith(query)
  })

  it("supports bootstrap registration without publishing partial collection state", () => {
    const store = storeFor()
    const registry = createLiveQueryRegistry({ store })
    const query = { queryId: 1 }

    registry.register(1, query, { publish: false })

    expect(registry.get(1)).toBe(query)
    expect(store.upsert).not.toHaveBeenCalled()
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
    const first = { queryId: "q1" }
    const second = { queryId: "q2" }
    registry.register("q1", first, { publish: false })
    registry.register("q2", second, { publish: false })

    expect(Object.keys(registry.all())).toEqual(["q2", "q1"])
    expect(registry.remove("q2")).toBe(true)
    expect(store.remove).toHaveBeenCalledWith("q2")
    expect(registry.get("q2")).toBeNull()
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
