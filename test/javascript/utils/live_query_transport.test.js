import { describe, expect, it, vi } from "vitest"
import { createLiveQueryTransportRuntime } from "utils/live_query_transport"

function runtimeFor(overrides = {}) {
  return createLiveQueryTransportRuntime({
    runtimeFor: vi.fn(query => ({
      search: vi.fn(() => Promise.resolve(query))
    })),
    getQueries: () => ({}),
    getRequestsPerMinute: () => 0,
    scoreAll: vi.fn(() => Promise.resolve({ score: 1 })),
    syncToBook: vi.fn(),
    ...overrides
  })
}

describe("createLiveQueryTransportRuntime", () => {
  it("searches, scores, and syncs one query", async () => {
    const query = { score: vi.fn(() => Promise.resolve()) }
    const syncToBook = vi.fn()
    const resetQuery = vi.fn()
    const runtime = runtimeFor({ syncToBook, resetQuery })

    await runtime.searchAndScore(query)

    expect(resetQuery).toHaveBeenCalledWith(query)
    expect(query.score).toHaveBeenCalledOnce()
    expect(syncToBook).toHaveBeenCalledOnce()
  })

  it("runs the batch search through the injected query collection", async () => {
    const first = { score: vi.fn(() => Promise.resolve()) }
    const second = { score: vi.fn(() => Promise.resolve()) }
    const scoreAll = vi.fn(() => Promise.resolve({ score: 1 }))
    const syncToBook = vi.fn()
    const resetQuery = vi.fn()
    const runtime = runtimeFor({
      getQueries: () => ({ 1: first, 2: second }),
      scoreAll,
      syncToBook,
      resetQuery
    })

    await runtime.searchAll()

    expect(first.score).toHaveBeenCalledOnce()
    expect(second.score).toHaveBeenCalledOnce()
    expect(resetQuery).toHaveBeenCalledWith(first)
    expect(resetQuery).toHaveBeenCalledWith(second)
    expect(scoreAll).toHaveBeenCalledOnce()
    expect(syncToBook).toHaveBeenCalledOnce()
  })
})
