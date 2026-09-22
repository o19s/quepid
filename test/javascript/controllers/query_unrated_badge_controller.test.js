import { afterEach, beforeEach, describe, expect, it } from "vitest"
import QueryUnratedBadgeController from "controllers/query_unrated_badge_controller"
import { CaseScoreStore } from "stores/case_score_store"

/**
 * First `searchResults`/`queriesCtrl` slice (docs/todo/angularjs_removal_inventory.md
 * § Re-render mechanism, step 5) — replaces the Angular `SearchResultsCtrl`'s
 * `query.isNotAllRated()` "unrated results" frog badge in `searchResults.html`,
 * following the same store-subscriber pattern step 4 used for the qscore
 * badges (`qscore_query_controller.test.js`).
 */
function buildController(element, { queryId = "1" } = {}) {
  const controller = Object.create(QueryUnratedBadgeController.prototype)
  controller.element = element
  controller.countTarget = element.querySelector('[data-query-unrated-badge-target="count"]')
  controller.queryIdValue = queryId
  return controller
}

describe("QueryUnratedBadgeController", () => {
  let element
  let countEl
  let store

  beforeEach(() => {
    element = document.createElement("span")
    element.classList.add("d-none")
    countEl = document.createElement("div")
    countEl.dataset.queryUnratedBadgeTarget = "count"
    element.appendChild(countEl)
    document.body.appendChild(element)

    store = new CaseScoreStore()
    window.quepidStore = { scoring: store }
  })

  afterEach(() => {
    element.remove()
    delete window.quepidStore
  })

  it("stays hidden before the store has any data", () => {
    const controller = buildController(element)
    QueryUnratedBadgeController.prototype.initialize.call(controller)
    QueryUnratedBadgeController.prototype.connect.call(controller)

    expect(element.classList.contains("d-none")).toBe(true)
  })

  it("shows the missing-ratings count once scored with unrated results", () => {
    store.setLatestScoreInfo({
      allRated: false,
      score:    0.5,
      queries:  { 1: { score: 0.5, allRated: false, countMissingRatings: 3 } }
    })

    const controller = buildController(element)
    QueryUnratedBadgeController.prototype.initialize.call(controller)
    QueryUnratedBadgeController.prototype.connect.call(controller)

    expect(element.classList.contains("d-none")).toBe(false)
    expect(countEl.textContent).toBe("3")
  })

  it("hides again once every result for this query is rated", () => {
    store.setLatestScoreInfo({
      allRated: false,
      score:    0.5,
      queries:  { 1: { score: 0.5, allRated: false, countMissingRatings: 1 } }
    })

    const controller = buildController(element)
    QueryUnratedBadgeController.prototype.initialize.call(controller)
    QueryUnratedBadgeController.prototype.connect.call(controller)
    expect(element.classList.contains("d-none")).toBe(false)

    store.setLatestScoreInfo({
      allRated: true,
      score:    1,
      queries:  { 1: { score: 1, allRated: true, countMissingRatings: 0 } }
    })

    expect(element.classList.contains("d-none")).toBe(true)
  })

  it("ignores other queries' scores (looks up by its own queryId)", () => {
    store.setLatestScoreInfo({
      allRated: false,
      score:    0.5,
      queries:  {
        1: { score: 1, allRated: true, countMissingRatings: 0 },
        2: { score: 0.5, allRated: false, countMissingRatings: 5 }
      }
    })

    const controller = buildController(element, { queryId: "2" })
    QueryUnratedBadgeController.prototype.initialize.call(controller)
    QueryUnratedBadgeController.prototype.connect.call(controller)

    expect(element.classList.contains("d-none")).toBe(false)
    expect(countEl.textContent).toBe("5")
  })

  it("stops reacting to store changes after disconnect", () => {
    const controller = buildController(element)
    QueryUnratedBadgeController.prototype.initialize.call(controller)
    QueryUnratedBadgeController.prototype.connect.call(controller)
    QueryUnratedBadgeController.prototype.disconnect.call(controller)

    store.setLatestScoreInfo({
      allRated: false,
      score:    0.5,
      queries:  { 1: { score: 0.5, allRated: false, countMissingRatings: 4 } }
    })

    expect(element.classList.contains("d-none")).toBe(true)
  })
})
