import { describe, expect, it, vi } from "vitest"
import { createLiveQueryCommandsRuntime } from "utils/live_query_commands"

describe("live query commands runtime", () => {
  function setup() {
    const query = {
      docs: [{ id: "doc-1" }],
      ratedDocs: [{ id: "rated-1" }],
      ratingsStore: {
        rateDocument: vi.fn().mockResolvedValue(undefined),
        resetRating: vi.fn().mockResolvedValue(undefined),
        rateBulkDocuments: vi.fn().mockResolvedValue(undefined),
        resetBulkRatings: vi.fn().mockResolvedValue(undefined)
      },
      touchModifiedAt: vi.fn()
    }
    const execution = {
      search: vi.fn().mockResolvedValue(undefined),
      refreshRatedDocs: vi.fn().mockResolvedValue(undefined),
      paginate: vi.fn().mockResolvedValue(undefined),
      ratedPaginate: vi.fn().mockResolvedValue(undefined)
    }
    const queryRuntime = { create: vi.fn().mockReturnValue(execution) }
    const documentRuntime = { reset: vi.fn(), publish: vi.fn() }
    const schedule = vi.fn(callback => callback())
    const getQuery = vi.fn().mockImplementation(queryId => queryId === 1 ? query : null)
    const getShowOnlyRated = vi.fn().mockReturnValue(false)
    const runtime = createLiveQueryCommandsRuntime({
      getQuery,
      getShowOnlyRated,
      queryRuntime,
      documentRuntime,
      schedule,
      reject: message => Promise.reject(message)
    })
    return { runtime, query, execution, queryRuntime, documentRuntime, schedule, getShowOnlyRated }
  }

  it("resets, publishes, and searches a live query", async () => {
    const { runtime, query, execution, documentRuntime } = setup()

    await runtime.searchQuery(1)

    expect(documentRuntime.reset).toHaveBeenCalledWith(query)
    expect(documentRuntime.publish).toHaveBeenCalledWith(query)
    expect(execution.search).toHaveBeenCalledOnce()
  })

  it("refreshes rated documents through the execution runtime", async () => {
    const { runtime, execution } = setup()

    await runtime.refreshRatedDocs(1, 25)

    expect(execution.refreshRatedDocs).toHaveBeenCalledWith(25)
  })

  it("schedules normal and rated pagination", () => {
    const { runtime, execution, schedule } = setup()

    expect(runtime.paginateQuery(1, false)).toBe(true)
    expect(runtime.paginateQuery(1, true)).toBe(true)

    expect(schedule).toHaveBeenCalledTimes(2)
    expect(execution.paginate).toHaveBeenCalledOnce()
    expect(execution.ratedPaginate).toHaveBeenCalledOnce()
  })

  it("rates an individual document and touches the query", async () => {
    const { runtime, query } = setup()

    expect(runtime.rateDocument(1, "doc-1", "4")).toBe(true)
    await Promise.resolve()

    expect(query.ratingsStore.rateDocument).toHaveBeenCalledWith("doc-1", 4)
    expect(query.touchModifiedAt).toHaveBeenCalledOnce()
  })

  it("rates the visible document collection", async () => {
    const { runtime, query } = setup()

    expect(runtime.rateAll(1, "3")).toBe(true)
    await Promise.resolve()
    await Promise.resolve()

    expect(query.ratingsStore.rateBulkDocuments).toHaveBeenCalledWith(["doc-1"], 3)
    expect(query.rating).toBe(3)
    expect(query.touchModifiedAt).toHaveBeenCalledOnce()
  })

  it("returns safe results for missing queries and documents", () => {
    const { runtime } = setup()

    expect(runtime.paginateQuery(9, false)).toBe(false)
    expect(runtime.rateDocument(9, "doc-1", 2)).toBe(false)
    expect(runtime.rateDocument(1, "missing", 2)).toBe(false)
    expect(runtime.rateAll(1, 2)).toBe(true)
  })
})
