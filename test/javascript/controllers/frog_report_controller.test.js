import { afterEach, describe, expect, it, vi } from "vitest"
import FrogReportController, { buildFrogReportStats } from "controllers/frog_report_controller"
import { QueryDocumentsStore } from "stores/query_documents_store"
import {
  resetCoreCapabilitiesForTest,
  resetCoreFlashForTest,
  resetCoreStoresForTest,
  setCoreCapabilitiesForTest,
  setCoreFlashForTest,
  setCoreStoresForTest
} from "utils/core_test_overrides"

describe("buildFrogReportStats", () => {
  it("counts results, ratings, and missing ratings from document snapshots", () => {
    expect(buildFrogReportStats([
      { docs: [{ id: 1 }, { id: 2 }], depthOfRating: 2, missingRatings: 1 },
      { docs: [], depthOfRating: 2, missingRatings: 0 }
    ])).toEqual({
      withResults: 1,
      withoutResults: 1,
      ratingsNeeded: 2,
      missingRatings: 1,
      missingRate: 50,
      allRated: false
    })
  })

  it("avoids a NaN missing rate when there are no results", () => {
    expect(buildFrogReportStats([{ docs: [], depthOfRating: 10, missingRatings: 0 }])).toMatchObject({
      ratingsNeeded: 0,
      missingRate: 0
    })
  })

  it("recognizes fully rated queries", () => {
    expect(buildFrogReportStats([{ docs: [{ id: 1 }], missingRatings: 0, allRated: true }]).allRated).toBe(true)
  })

  it("treats unknown missing counts as every returned doc up to the rating depth", () => {
    expect(buildFrogReportStats([
      { docs: [{ id: 1 }, { id: 2 }, { id: 3 }], depthOfRating: 2 },
      { docs: [{ id: 4 }] }
    ])).toMatchObject({ ratingsNeeded: 4, missingRatings: 2, missingRate: 50, allRated: false })
    expect(buildFrogReportStats([]).allRated).toBe(false)
  })
})

const TARGETS = [
  "caseName", "queryCount", "withResults", "withoutResults", "ratingsNeeded",
  "allRated", "notAllRated", "missingRatings", "missingRate", "hopMessage",
  "chart", "refreshButton", "refreshIcon", "bookName", "error"
]

function buildController({ queries = {}, caseState = {}, queryLifecycle } = {}) {
  const store = new QueryDocumentsStore()
  Object.entries(queries).forEach(([id, state]) => {
    store.collection.upsert({
      queryId: Number(id),
      currentScore: { score: 0, countMissingRatings: state.missingRatings, allRated: state.allRated }
    })
    store.replaceQuery(id, state)
  })
  setCoreStoresForTest({ documents: store })
  setCoreCapabilitiesForTest({ caseState, queryLifecycle })
  const controller = Object.create(FrogReportController.prototype)
  controller.element = document.createElement("div")
  TARGETS.forEach((name) => {
    const element = document.createElement("div")
    controller[`${name}Target`] = element
    controller[`has${name[0].toUpperCase()}${name.slice(1)}Target`] = true
  })
  controller.lifecycle = {}
  controller.store = store
  return controller
}

describe("FrogReportController", () => {
  afterEach(() => {
    resetCoreCapabilitiesForTest()
    resetCoreStoresForTest()
    resetCoreFlashForTest()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    delete window.vegaEmbed
  })

  it("buckets queries by missing ratings for the chart, labelling the extremes", () => {
    const controller = buildController()

    expect(controller.distribution([
      { depthOfRating: 3, missingRatings: 0 },
      { depthOfRating: 3, missingRatings: 0 },
      { missingRatings: 2 },
      { missingRatings: 3 },
      { docs: [{ id: 1 }] }
    ])).toEqual([
      { category: "Fully Rated", amount: 2 },
      { category: "Missing 1", amount: 1 },
      { category: "Missing 2", amount: 1 },
      { category: "No Ratings", amount: 1 }
    ])
  })

  it("renders the case's rating stats and shows the hop-to-it message past 5% missing", () => {
    const controller = buildController({
      queries: { 1: { docs: [{ id: "a" }, { id: "b" }], missingRatings: 1 }, 2: { docs: [] } },
      caseState: { caseName: "Books", bookName: "Catalog", bookId: 3 }
    })

    controller.render()

    expect(controller.caseNameTarget.textContent).toBe("Books")
    expect(controller.bookNameTarget.textContent).toBe("Catalog")
    expect(controller.queryCountTarget.textContent).toBe("2")
    expect(controller.withResultsTarget.textContent).toBe("1")
    expect(controller.withoutResultsTarget.textContent).toBe("1")
    expect(controller.ratingsNeededTarget.textContent).toBe("2")
    expect(controller.missingRatingsTarget.textContent).toBe("1")
    expect(controller.missingRateTarget.textContent).toBe("50")
    expect(controller.allRatedTarget.classList.contains("d-none")).toBe(true)
    expect(controller.notAllRatedTarget.classList.contains("d-none")).toBe(false)
    expect(controller.hopMessageTarget.classList.contains("d-none")).toBe(false)
    expect(controller.refreshButtonTarget.classList.contains("d-none")).toBe(false)
  })

  it("hides the hop message and refresh button for a fully rated case with no book", () => {
    const controller = buildController({ queries: { 1: { docs: [{ id: "a" }], missingRatings: 0, allRated: true } } })

    controller.render()

    expect(controller.allRatedTarget.classList.contains("d-none")).toBe(false)
    expect(controller.notAllRatedTarget.classList.contains("d-none")).toBe(true)
    expect(controller.hopMessageTarget.classList.contains("d-none")).toBe(true)
    expect(controller.refreshButtonTarget.classList.contains("d-none")).toBe(true)
    expect(controller.caseNameTarget.textContent).toBe("")
  })

  it("refreshes ratings from the book in the foreground for a small case, then reloads queries", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("{}", { status: 200 }))))
    const refreshQueries = vi.fn(() => Promise.resolve())
    const flash = { show: vi.fn() }
    setCoreFlashForTest(flash)
    const controller = buildController({ queries: { 1: {} }, caseState: { bookId: 3, caseNo: 9 }, queryLifecycle: { refreshQueries } })
    controller.refreshUrlTemplateValue = "books/__BOOK_ID__/cases/9/refresh?background=__BACKGROUND__"

    await controller.refresh()

    expect(fetch).toHaveBeenCalledWith("books/3/cases/9/refresh?background=false", expect.objectContaining({ method: "PUT" }))
    expect(refreshQueries).toHaveBeenCalledWith(9)
    expect(flash.show).toHaveBeenCalledWith("success", "Ratings have been refreshed.")
    expect(controller.refreshButtonTarget.disabled).toBe(false)
    expect(controller.refreshIconTarget.classList.contains("spintime")).toBe(false)
  })

  it("refreshes a case with 50+ queries in the background and returns to the home page", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("{}", { status: 200 }))))
    const assign = vi.spyOn(window.location, "assign").mockImplementation(() => {})
    const refreshQueries = vi.fn()
    setCoreFlashForTest({ show: vi.fn() })
    const queries = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [i + 1, {}]))
    const controller = buildController({ queries, caseState: { bookId: 3, caseNo: 9 }, queryLifecycle: { refreshQueries } })
    controller.refreshUrlTemplateValue = "refresh?background=__BACKGROUND__"

    await controller.refresh()

    expect(fetch.mock.calls[0][0]).toBe("refresh?background=true")
    expect(refreshQueries).not.toHaveBeenCalled()
    expect(assign).toHaveBeenCalledOnce()
  })

  it("shows the error and re-enables refresh when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("{}", { status: 500, statusText: "Server Error" }))))
    const controller = buildController({ caseState: { bookId: 3, caseNo: 9 } })
    controller.refreshUrlTemplateValue = "refresh"

    await controller.refresh()

    expect(controller.errorTarget.textContent).toBe("An error (500 Server Error) occurred, please try again.")
    expect(controller.errorTarget.classList.contains("d-none")).toBe(false)
    expect(controller.refreshButtonTarget.disabled).toBe(false)
  })

  it("does not refresh without a book and case", async () => {
    vi.stubGlobal("fetch", vi.fn())
    const controller = buildController({ caseState: { bookId: 3 } })

    await controller.refresh()

    expect(fetch).not.toHaveBeenCalled()
  })
  it("finalizes superseded and disconnected chart results without mounting them", async () => {
    const complete = []
    window.vegaEmbed = vi.fn(() => new Promise(resolve => complete.push(resolve)))
    const controller = buildController()
    controller.renderChart([])
    controller.renderChart([])
    const oldResult = { finalize: vi.fn() }
    const currentResult = { finalize: vi.fn() }
    complete[1](currentResult)
    await Promise.resolve()
    expect(controller.chartResult).toBe(currentResult)
    complete[0](oldResult)
    await Promise.resolve()
    expect(oldResult.finalize).toHaveBeenCalledOnce()
    expect(controller.chartResult).toBe(currentResult)
    controller.renderChart([])
    expect(currentResult.finalize).toHaveBeenCalledOnce()
    controller.disconnect()
    const lateResult = { finalize: vi.fn() }
    complete[2](lateResult)
    await Promise.resolve()
    expect(lateResult.finalize).toHaveBeenCalledOnce()
    expect(controller.chartResult).toBeNull()
  })

  it.each([200, 500])("completes the shared mutation but ignores late UI feedback (%s) after disconnect", async status => {
    let complete
    vi.stubGlobal("fetch", vi.fn(() => new Promise(resolve => { complete = resolve })))
    const refreshQueries = vi.fn().mockResolvedValue()
    const flash = { show: vi.fn() }
    setCoreFlashForTest(flash)
    const controller = buildController({
      queries: { 1: {} }, caseState: { bookId: 3, caseNo: 9 }, queryLifecycle: { refreshQueries }
    })
    controller.refreshUrlTemplateValue = "refresh"
    const pending = controller.refresh()
    controller.disconnect()
    controller.errorTarget.textContent = "new connection"
    controller.lifecycle = {}
    complete(new Response("{}", { status }))
    await pending
    expect(refreshQueries).toHaveBeenCalledTimes(status === 200 ? 1 : 0)
    expect(controller.errorTarget.textContent).toBe("new connection")
    expect(flash.show).not.toHaveBeenCalled()
  })

  it("removes its store subscription and hide listener before reconnecting", () => {
    const controller = buildController()
    const modal = document.createElement("div")
    modal.className = "modal"
    modal.append(controller.element)
    controller.modalRootValue = true
    const render = vi.spyOn(controller, "render").mockImplementation(() => {})
    controller.connect()
    controller.disconnect()
    const count = render.mock.calls.length
    controller.store.dispatchEvent(new Event("change"))
    expect(render).toHaveBeenCalledTimes(count)
    controller.connect()
    controller.store.dispatchEvent(new Event("change"))
    expect(render).toHaveBeenCalledTimes(count + 2)
    modal.dispatchEvent(new Event("hide.bs.modal"))
    controller.store.dispatchEvent(new Event("change"))
    expect(render).toHaveBeenCalledTimes(count + 2)
    expect(controller.lifecycle).toBeNull()
    controller.disconnect()
  })

})
