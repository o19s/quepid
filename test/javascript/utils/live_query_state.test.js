import { describe, expect, it, vi } from "vitest"
import { createLiveQueryStateRuntime } from "utils/live_query_state"

function runtimeFor(overrides = {}) {
  const ready = { resolve: vi.fn(), promise: vi.fn(() => Promise.resolve()) }
  return createLiveQueryStateRuntime({
    getQueries: vi.fn(() => ({})),
    scoreAll: vi.fn(() => Promise.resolve()),
    applySettings: vi.fn(),
    setLifecycleCaseId: vi.fn(),
    getCurrentCaseNo: vi.fn(() => 1),
    setCurrentCaseNo: vi.fn(),
    bootstrapScorer: vi.fn(),
    bootstrapQueries: vi.fn(),
    configureBook: vi.fn(),
    refreshQueryDiff: vi.fn(),
    queryReady: ready,
    promiseApi: Promise,
    ...overrides
  })
}

describe("createLiveQueryStateRuntime", () => {
  it("marks live queries dirty and refreshes scores", async () => {
    const query = { diff: null, setDirty: vi.fn() }
    const scoreAll = vi.fn(() => Promise.resolve())
    const runtime = runtimeFor({ getQueries: vi.fn(() => ({ 1: query })), scoreAll })

    await runtime.updateScores()

    expect(query.setDirty).toHaveBeenCalled()
    expect(scoreAll).toHaveBeenCalledWith()
  })

  it("scores only live query diffs", async () => {
    const firstDiff = { score: vi.fn() }
    const secondQuery = { diff: null }
    const scoreAll = vi.fn(() => Promise.resolve())
    const runtime = runtimeFor({
      getQueries: vi.fn(() => ({ 1: { diff: firstDiff }, 2: secondQuery })),
      scoreAll
    })

    await runtime.scoreAllDiffs()

    expect(scoreAll).toHaveBeenCalledWith([firstDiff])
  })

  it("refreshes same-case diffs and bootstraps a new case", async () => {
    const query = { diff: { fetch: vi.fn() } }
    const refreshQueryDiff = vi.fn()
    const bootstrapScorer = vi.fn()
    const bootstrapQueries = vi.fn()
    const configureBook = vi.fn()
    const setCurrentCaseNo = vi.fn()
    const runtime = runtimeFor({
      getQueries: vi.fn(() => ({ 1: query })),
      refreshQueryDiff,
      bootstrapScorer,
      bootstrapQueries,
      configureBook,
      setCurrentCaseNo
    })

    await runtime.changeSettings(1, { selectedTry: {} })
    expect(refreshQueryDiff).toHaveBeenCalledWith(query)

    await runtime.changeSettings(2, { selectedTry: {} })
    expect(bootstrapScorer).toHaveBeenCalledWith(2)
    expect(bootstrapQueries).toHaveBeenCalledWith(2)
    expect(configureBook).toHaveBeenCalledWith(2)
    expect(setCurrentCaseNo).toHaveBeenCalledWith(2)
  })
})
