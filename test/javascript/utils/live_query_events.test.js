import { beforeEach, describe, expect, it, vi } from "vitest"
import { createLiveQueryEventsRuntime } from "utils/live_query_events"

describe("live query events runtime", () => {
  beforeEach(() => {
    window.quepidSearch = {
      queryState: {
        ratingChangedQueryId: vi.fn().mockReturnValue(1),
        invalidateRatedDocsCache: vi.fn()
      }
    }
  })

  function setup() {
    const eventTarget = new EventTarget()
    const scoringStore = new EventTarget()
    const query = { queryId: 1, options: {}, setDirty: vi.fn() }
    const getQuery = vi.fn().mockImplementation(id => id === 1 ? query : null)
    const scoreAll = vi.fn().mockResolvedValue(undefined)
    const invalidateRatedDocs = vi.fn()
    const schedule = vi.fn(callback => callback())
    const scheduleApply = vi.fn(callback => callback())
    const setScorer = vi.fn().mockResolvedValue(undefined)
    const reloadQueries = vi.fn().mockResolvedValue(undefined)
    const runtime = createLiveQueryEventsRuntime({
      eventTarget,
      scoringStore,
      getCaseNo: vi.fn().mockReturnValue(7),
      getQuery,
      getQueries: () => ({ 1: query }),
      invalidateRatedDocs,
      publishQuery: vi.fn(),
      scoreAll,
      setQueryOptions: (target, options) => {
        target.options = options
        target.setDirty()
      },
      setScorer,
      reloadQueries,
      schedule,
      scheduleApply
    })
    runtime.connect()
    return { eventTarget, scoringStore, query, scoreAll, schedule, scheduleApply, setScorer, reloadQueries, invalidateRatedDocs }
  }

  it("invalidates and rescoring on rating changes", () => {
    const { scoringStore, scoreAll, invalidateRatedDocs } = setup()

    scoringStore.dispatchEvent(new CustomEvent("rating-changed", { detail: { queryId: 1 } }))

    expect(invalidateRatedDocs).toHaveBeenCalled()
    expect(scoreAll).toHaveBeenCalledOnce()
  })

  it("applies query options only for the active case", () => {
    const { eventTarget, query } = setup()

    eventTarget.dispatchEvent(new CustomEvent("query-options:saved", {
      detail: { caseId: 7, queryId: 1, options: { field: "title" } }
    }))

    expect(query.options).toEqual({ field: "title" })
    expect(query.setDirty).toHaveBeenCalledOnce()
  })

  it("applies a selected scorer and rescoring", async () => {
    const { eventTarget, setScorer, scoreAll, scheduleApply } = setup()

    eventTarget.dispatchEvent(new CustomEvent("pick-scorer:selected", {
      detail: { caseId: 7, scorer: { id: 3 } }
    }))
    await Promise.resolve()

    expect(scheduleApply).toHaveBeenCalledOnce()
    expect(setScorer).toHaveBeenCalledWith({ id: 3 })
    expect(scoreAll).toHaveBeenCalledOnce()
  })

  it("reloads queries for judgement and import events", () => {
    const { eventTarget, reloadQueries } = setup()

    eventTarget.dispatchEvent(new CustomEvent("judgements:queries-need-reload", { detail: { caseId: 7 } }))
    eventTarget.dispatchEvent(new CustomEvent("imports:queries-need-reload", { detail: { caseId: 7 } }))

    expect(reloadQueries).toHaveBeenNthCalledWith(1, 7)
    expect(reloadQueries).toHaveBeenNthCalledWith(2, 7)
  })
})
