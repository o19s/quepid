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
    onVersion: vi.fn(),
    searchAndScore: vi.fn(() => Promise.resolve()),
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
    const onVersion = vi.fn()
    const updateScores = vi.fn()
    const runtime = runtimeFor({ removeQuery, onVersion, updateScores })

    expect(runtime.reconcileQueryRemoval(12, true)).toBe(true)
    expect(removeQuery).toHaveBeenCalledWith(12)
    expect(onVersion).toHaveBeenCalledOnce()
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
