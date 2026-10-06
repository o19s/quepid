import { buildControllerFixture } from "../support/controller_fixture"
import { beforeEach, describe, expect, it, vi } from "vitest"
import QueriesList from "controllers/queries_list_controller"
import DiffScore from "controllers/diff_score_controller"
import QscoreCase from "controllers/qscore_case_controller"
import QscoreQuery from "controllers/qscore_query_controller"
import UnratedBadge from "controllers/query_unrated_badge_controller"
import DiffCaseScores from "controllers/diff_case_scores_controller"
import FrogReport from "controllers/frog_report_controller"
import Annotations from "controllers/annotations_controller"
import SearchResults from "controllers/search_results_controller"

const { stores } = vi.hoisted(() => ({ stores: {} }))
vi.mock("utils/core_store_access", () => ({ getCoreStores: () => stores }))
vi.mock("utils/core_capability_access", () => ({ getCoreCapabilities: () => ({}) }))

const cases = [
  ["queries list", QueriesList, ["queries", "documents"], ["change", "reset", "search-failed", "search-started"]],
  ["diff score", DiffScore, ["documents"], ["change"]],
  ["case score", QscoreCase, ["scoring"], ["change", "scoring-complete", "rating-changed"]],
  ["query score", QscoreQuery, ["scoring"], ["change"]],
  ["unrated badge", UnratedBadge, ["scoring"], ["change"]],
  ["case diff scores", DiffCaseScores, ["documents"], ["change", "reset"]],
  ["frog report", FrogReport, ["documents"], ["change", "reset"]],
  ["annotations", Annotations, ["scoring"], ["change"]],
  ["search results", SearchResults, ["documents"], ["change", "reset"]]
]

beforeEach(() => {
  for (const name of ["queries", "documents", "scoring"]) {
    stores[name] = new EventTarget()
    vi.spyOn(stores[name], "addEventListener")
    vi.spyOn(stores[name], "removeEventListener")
  }
})

describe("controller store subscription lifecycles", () => {
  it.each([
    ["diff score", DiffScore],
    ["case diff scores", DiffCaseScores],
    ["annotations", Annotations]
  ])("%s still supports an absent optional store", (_, Controller) => {
    delete stores.documents
    delete stores.scoring
    const controller = buildControllerFixture(Controller, {
      overrides: {
        render: vi.fn(),
        load: vi.fn()
      }
    })
    expect(() => controller.connect()).not.toThrow()
    expect(() => controller.disconnect()).not.toThrow()
  })

  it("does not subscribe the Frog Report launcher", () => {
    const controller = buildControllerFixture(FrogReport, {
      values: {
        modalRoot: false
      },
      overrides: {
        render: vi.fn()
      }
    })
    controller.connect()
    controller.disconnect()
    expect(stores.documents.addEventListener).not.toHaveBeenCalled()
    expect(controller.render).not.toHaveBeenCalled()
  })

  it.each(cases)("%s preserves event lists and cleans up across reconnects", (_, Controller, storeNames, events) => {
    const controller = buildControllerFixture(Controller, {
      element: document.createElement("div"),
      values: {
        modalRoot: true
      }
    })
    for (const method of ["render", "renderScore", "renderLabel", "scheduleRender", "syncSortFromUrl", "setupSortable", "load", "updateCreateState", "renderFromStore", "handleSearchFailed", "handleSearchSettled", "persistScore", "refreshCaseDiffScores"]) {
      controller[method] = vi.fn()
    }
    controller.initialize?.()
    controller.connect()
    const store = stores[storeNames[0]]
    expect(store.addEventListener.mock.calls.map(([event]) => event)).toEqual(events)
    if (storeNames.length > 1) {
      expect(stores.documents.addEventListener.mock.calls.map(([event]) => event)).toEqual(["change", "reset"])
    }
    // Initial work is owned by each controller, not by the subscription helper.
    const initial = Controller === QscoreCase ? controller.renderScore : Controller === Annotations ? controller.load : controller.render
    expect(initial).toHaveBeenCalledTimes(1)
    const observer = Controller === QueriesList ? controller.scheduleRender : Controller === QscoreCase ? controller.renderScore : Controller === Annotations ? controller.updateCreateState : Controller === SearchResults ? controller.renderFromStore : controller.render
    observer.mockClear()
    const event = new CustomEvent("change", { detail: { queryId: 7 } })
    store.dispatchEvent(event)
    expect(observer).toHaveBeenCalledTimes(1)
    if (Controller === SearchResults) expect(observer).toHaveBeenCalledWith(event.detail)
    controller.disconnect()
    expect(store.removeEventListener.mock.calls).toEqual(store.addEventListener.mock.calls)
    observer.mockClear()
    store.dispatchEvent(event)
    expect(observer).not.toHaveBeenCalled()
    controller.connect()
    observer.mockClear()
    store.dispatchEvent(event)
    expect(observer).toHaveBeenCalledTimes(1)
    controller.disconnect()
  })
})
