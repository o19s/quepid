import { describe, expect, it, vi } from "vitest"
import { createLiveQueryEventsRuntime } from "utils/live_query_events"

describe("live query events runtime", () => {
  function setup({ onError } = {}) {
    const eventTarget = new EventTarget()
    const scoringStore = new EventTarget()
    const query = { queryId: 1, options: {}, setDirty: vi.fn() }
    const getQuery = vi.fn().mockImplementation(id => id === 1 ? query : null)
    const scoreAll = vi.fn().mockResolvedValue(undefined)
    const invalidateRatedDocs = vi.fn()
    const schedule = vi.fn(callback => callback())
    const setScorer = vi.fn().mockResolvedValue(undefined)
    const reloadQueries = vi.fn().mockResolvedValue(undefined)
    const configureBook = vi.fn()
    const runtime = createLiveQueryEventsRuntime({
      eventTarget,
      scoringStore,
      getCaseNo: vi.fn().mockReturnValue(7),
      getQuery,
      getQueries: () => ({ 1: query }),
      ratingChangedQueryId: vi.fn().mockReturnValue(1),
      invalidateRatedDocs,
      publishQuery: vi.fn(),
      scoreAll,
      setQueryOptions: (target, options) => {
        target.options = options
        target.setDirty()
      },
      setScorer,
      reloadQueries,
      configureBook,
      schedule,
      onError
    })
    runtime.connect()
    return { runtime, eventTarget, scoringStore, query, scoreAll, schedule, setScorer, reloadQueries, configureBook, invalidateRatedDocs }
  }

  it("invalidates and rescoring on rating changes", () => {
    const { scoringStore, scoreAll, invalidateRatedDocs } = setup()

    scoringStore.dispatchEvent(new CustomEvent("rating-changed", { detail: { queryId: 1 } }))

    expect(invalidateRatedDocs).toHaveBeenCalled()
    expect(scoreAll).toHaveBeenCalledOnce()
  })

  it("uses only the scoring store event, with no document fallback", () => {
    const { eventTarget, scoreAll } = setup()
    eventTarget.dispatchEvent(new CustomEvent("ratings:changed", { detail: { queryId: 1 } }))
    expect(scoreAll).not.toHaveBeenCalled()
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
    const { eventTarget, setScorer, scoreAll, schedule } = setup()

    eventTarget.dispatchEvent(new CustomEvent("pick-scorer:selected", {
      detail: { caseId: 7, scorer: { id: 3 } }
    }))
    await Promise.resolve()

    expect(schedule).toHaveBeenCalledOnce()
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

  it("reconfigures book sync when the active case's book settings are saved", () => {
    const { eventTarget, configureBook } = setup()

    eventTarget.dispatchEvent(new CustomEvent("quepid:case-book-updated", {
      detail: { caseId: 7, bookId: 4, bookName: "Catalog", autoPopulateBookPairs: true }
    }))
    eventTarget.dispatchEvent(new CustomEvent("quepid:case-book-updated", {
      detail: { caseId: 7, bookId: null, autoPopulateBookPairs: false }
    }))

    expect(configureBook).toHaveBeenNthCalledWith(1, { bookId: 4, autoPopulate: true })
    expect(configureBook).toHaveBeenNthCalledWith(2, { bookId: null, autoPopulate: false })
  })

  it("ignores book settings saved for another case", () => {
    const { eventTarget, configureBook } = setup()

    eventTarget.dispatchEvent(new CustomEvent("quepid:case-book-updated", {
      detail: { caseId: 8, bookId: 4, autoPopulateBookPairs: true }
    }))

    expect(configureBook).not.toHaveBeenCalled()
  })

  it("registers handlers once however often it connects", () => {
    const { runtime, eventTarget, reloadQueries } = setup()

    runtime.connect()
    eventTarget.dispatchEvent(new CustomEvent("judgements:queries-need-reload", { detail: { caseId: 7 } }))

    expect(reloadQueries).toHaveBeenCalledOnce()
  })

  it("reports a failed query reload instead of leaving the rejection unhandled", async () => {
    const onError = vi.fn()
    const { eventTarget, reloadQueries } = setup({ onError })
    const failure = new Error("boom")
    reloadQueries.mockRejectedValueOnce(failure)

    eventTarget.dispatchEvent(new CustomEvent("judgements:queries-need-reload", { detail: { caseId: 7 } }))
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith("Could not reload queries", failure))
  })

  it("reports a failed scorer change without rescoring", async () => {
    const onError = vi.fn()
    const { eventTarget, setScorer, scoreAll } = setup({ onError })
    const failure = new Error("nope")
    setScorer.mockRejectedValueOnce(failure)

    eventTarget.dispatchEvent(new CustomEvent("pick-scorer:selected", { detail: { caseId: 7, scorer: { id: 3 } } }))
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith("Could not apply the selected scorer", failure))
    expect(scoreAll).not.toHaveBeenCalled()
  })

  it("logs failures by default", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const { eventTarget, reloadQueries } = setup()
    reloadQueries.mockRejectedValueOnce(new Error("boom"))

    eventTarget.dispatchEvent(new CustomEvent("imports:queries-need-reload", { detail: { caseId: 7 } }))
    await vi.waitFor(() => expect(error).toHaveBeenCalledWith("live-query-events: Could not reload queries", expect.any(Error)))
    error.mockRestore()
  })
})
