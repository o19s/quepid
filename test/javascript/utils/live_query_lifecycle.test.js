import { describe, expect, it, vi } from "vitest"
import { createLiveQueryLifecycleRuntime } from "utils/live_query_lifecycle"

function runtimeFor(overrides = {}) {
  return createLiveQueryLifecycleRuntime({
    createQuery: vi.fn((text) => ({ queryText: text })),
    reset: vi.fn(),
    bootstrapQueries: vi.fn(() => Promise.resolve()),
    searchAll: vi.fn(() => Promise.resolve()),
    clearQueries: vi.fn(),
    addQueriesFromResponse: vi.fn(),
    getCaseNo: vi.fn(() => 7),
    applyDisplayOrder: vi.fn(),
    setQueryId: vi.fn(),
    registerQuery: vi.fn(),
    removeQuery: vi.fn(() => true),
    searchAndScore: vi.fn(() => Promise.resolve()),
    syncToBook: vi.fn(() => Promise.resolve()),
    updateScores: vi.fn(),
    logger: { info: vi.fn() },
    ...overrides
  })
}

describe("createLiveQueryLifecycleRuntime", () => {
  it("prepares single and bulk query commits", () => {
    const createQuery = vi.fn((text) => ({ queryText: text }))
    const runtime = runtimeFor({ createQuery })

    expect(runtime.prepareQueries(["star wars"])).toEqual({ query: { queryText: "star wars" } })
    expect(runtime.prepareQueries(["star wars", "dune"])).toEqual({
      queries: [{ queryText: "star wars" }, { queryText: "dune" }]
    })
    expect(createQuery).toHaveBeenCalledTimes(3)
  })

  it("commits a persisted single query and preserves the search-error result contract", async () => {
    const searchError = new Error("timeout")
    const searchAndScore = vi.fn(() => Promise.reject(searchError))
    const applyDisplayOrder = vi.fn()
    const setQueryId = vi.fn()
    const registerQuery = vi.fn()
    const updateScores = vi.fn()
    const runtime = runtimeFor({ searchAndScore, applyDisplayOrder, setQueryId, registerQuery, updateScores })
    const query = { ratingsStore: { setQueryId: vi.fn() } }

    await expect(runtime.commitQueries({ query }, {
      status: 201,
      data: { display_order: [12], query: { query_id: 12 } }
    })).resolves.toEqual({ searchError })

    expect(applyDisplayOrder).toHaveBeenCalledWith([12])
    expect(setQueryId).toHaveBeenCalledWith(query, 12)
    expect(registerQuery).toHaveBeenCalledWith(12, query)
    expect(updateScores).not.toHaveBeenCalled()
  })

  it("rescores after a single query searches successfully", async () => {
    const updateScores = vi.fn()
    const registerQuery = vi.fn()
    const runtime = runtimeFor({ updateScores, registerQuery })

    await expect(runtime.commitQueries({ query: {} }, { status: 204 })).resolves.toEqual({})

    expect(registerQuery).not.toHaveBeenCalled()
    expect(updateScores).toHaveBeenCalledOnce()
  })

  it("refreshes case scores before reporting a single-query book sync failure", async () => {
    const syncError = new Error("Book auto-sync could not submit all new results")
    const updateScores = vi.fn()
    const syncToBook = vi.fn(() => {
      expect(updateScores).toHaveBeenCalledOnce()
      return Promise.reject(syncError)
    })
    const runtime = runtimeFor({ updateScores, syncToBook })

    await expect(runtime.commitQueries({ query: {} }, { status: 204 }))
      .resolves.toEqual({ searchError: syncError })
    expect(syncToBook).toHaveBeenCalledOnce()
  })

  it("does not sync a single query whose search failed", async () => {
    const searchError = new Error("engine down")
    const syncToBook = vi.fn()
    const runtime = runtimeFor({
      searchAndScore: vi.fn(() => Promise.reject(searchError)),
      syncToBook
    })

    await expect(runtime.commitQueries({ query: {} }, { status: 204 }))
      .resolves.toEqual({ searchError })
    expect(syncToBook).not.toHaveBeenCalled()
  })

  it("replaces the collection from the response for bulk commits, then searches", async () => {
    const clearQueries = vi.fn()
    const addQueriesFromResponse = vi.fn()
    const searchError = new Error("engine down")
    const searchAll = vi.fn().mockResolvedValueOnce().mockRejectedValueOnce(searchError)
    const runtime = runtimeFor({ clearQueries, addQueriesFromResponse, searchAll })
    const persisted = { data: { queries: [{ query_id: 1 }, { query_id: 2 }] } }

    await expect(runtime.commitQueries({ queries: [{}, {}] }, persisted)).resolves.toEqual({})
    await expect(runtime.commitQueries({ queries: [{}, {}] }, persisted)).resolves.toEqual({ searchError })

    expect(clearQueries).toHaveBeenCalledTimes(2)
    expect(addQueriesFromResponse).toHaveBeenCalledWith(persisted.data, 7)
  })

  it("commits already-persisted queries without searching", () => {
    const clearQueries = vi.fn()
    const addQueriesFromResponse = vi.fn()
    const searchAll = vi.fn()
    const runtime = runtimeFor({ clearQueries, addQueriesFromResponse, searchAll })

    expect(runtime.commitPersistedQueries({ data: { queries: [] } })).toEqual({})

    expect(clearQueries).toHaveBeenCalledOnce()
    expect(addQueriesFromResponse).toHaveBeenCalledWith({ queries: [] }, 7)
    expect(searchAll).not.toHaveBeenCalled()
  })

  it("does not rescore a reconciled removal unless asked to", () => {
    const updateScores = vi.fn()
    const runtime = runtimeFor({ updateScores })

    expect(runtime.reconcileQueryRemoval(12)).toBe(true)
    expect(updateScores).not.toHaveBeenCalled()
  })

  it("refreshes by resetting, bootstrapping, and searching", async () => {
    const reset = vi.fn()
    const bootstrapQueries = vi.fn(() => Promise.resolve())
    const searchAll = vi.fn(() => Promise.resolve())
    const runtime = runtimeFor({ reset, bootstrapQueries, searchAll })

    await runtime.refreshQueries(9)

    expect(reset).toHaveBeenCalled()
    expect(bootstrapQueries).toHaveBeenCalledWith(9)
    expect(searchAll).toHaveBeenCalled()
  })

  it("reconciles a removed query and optionally rescoring", () => {
    const removeQuery = vi.fn(() => true)
    const updateScores = vi.fn()
    const runtime = runtimeFor({ removeQuery, updateScores })

    expect(runtime.reconcileQueryRemoval(12, true)).toBe(true)
    expect(removeQuery).toHaveBeenCalledWith(12)
    expect(updateScores).toHaveBeenCalledOnce()
  })

  it("does not rescore when removal cannot be reconciled", () => {
    const removeQuery = vi.fn(() => false)
    const updateScores = vi.fn()
    const runtime = runtimeFor({ removeQuery, updateScores })

    expect(runtime.reconcileQueryRemoval(12, true)).toBe(false)
    expect(updateScores).not.toHaveBeenCalled()
  })
})
