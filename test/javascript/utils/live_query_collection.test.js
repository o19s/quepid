import { describe, expect, it, vi } from "vitest"
import { createLiveQueryCollectionRuntime } from "utils/live_query_collection"

function runtimeFor(overrides = {}) {
  return createLiveQueryCollectionRuntime({
    request: vi.fn(() => Promise.resolve({ data: { queries: [] } })),
    createQuery: vi.fn(data => data),
    createDiff: vi.fn(),
    clearQueries: vi.fn(),
    registerQuery: vi.fn(),
    applyDisplayOrder: vi.fn(),
    replaceStore: vi.fn(),
    beginStoreBootstrap: vi.fn(),
    markStoreError: vi.fn(),
    setBootstrapping: vi.fn(),
    publishState: vi.fn(),
    defer: () => {
      let resolve
      let reject
      const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise
        reject = rejectPromise
      })
      return { promise, resolve, reject }
    },
    logger: { debug: vi.fn() },
    ...overrides
  })
}

describe("createLiveQueryCollectionRuntime", () => {
  it("registers live queries, creates diffs, and publishes the store snapshot", () => {
    const createQuery = vi.fn(data => ({ id: data.queryId }))
    const createDiff = vi.fn()
    const registerQuery = vi.fn()
    const replaceStore = vi.fn()
    const applyDisplayOrder = vi.fn()
    const runtime = runtimeFor({ createQuery, createDiff, registerQuery, replaceStore, applyDisplayOrder })

    expect(runtime.addQueriesFromResponse({
      display_order: [4],
      queries: [
        { query_id: 4, query_text: "star wars" },
        { query_id: 5, query_text: "deleted", deleted: "true" }
      ]
    }, 9)).toEqual([4])

    expect(createQuery).toHaveBeenCalledWith({ query_id: 4, query_text: "star wars", queryId: 4 })
    expect(createDiff).toHaveBeenCalledWith({ id: 4 })
    expect(registerQuery).toHaveBeenCalledWith(4, { id: 4 })
    expect(applyDisplayOrder).toHaveBeenCalledWith([4])
    expect(replaceStore).toHaveBeenCalledWith(9, expect.any(Object))
  })

  it("keeps stale bootstrap responses from replacing the active collection", async () => {
    const requests = []
    const request = vi.fn(() => new Promise((resolve, reject) => requests.push({ resolve, reject })))
    const clearQueries = vi.fn()
    const runtime = runtimeFor({ request, clearQueries })

    const first = runtime.bootstrapQueries(4)
    const second = runtime.bootstrapQueries(5)
    requests[0].resolve({ data: { queries: [{ query_id: 1 }] } })
    await expect(first).rejects.toMatchObject({ statusText: "Stale bootstrap request" })
    expect(clearQueries).not.toHaveBeenCalled()

    requests[1].resolve({ data: { queries: [{ query_id: 2 }] } })
    await expect(second).resolves.toBeUndefined()
    expect(clearQueries).toHaveBeenCalledOnce()
  })

  it("rejects the searchable promise and marks the store on an active bootstrap failure", async () => {
    const request = vi.fn(() => Promise.reject({ status: 500 }))
    const markStoreError = vi.fn()
    const runtime = runtimeFor({ request, markStoreError })

    await expect(runtime.bootstrapQueries(4)).rejects.toMatchObject({ status: 500 })
    expect(markStoreError).toHaveBeenCalledWith({ status: 500 })
  })
})
