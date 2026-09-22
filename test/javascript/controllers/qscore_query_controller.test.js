import { afterEach, beforeEach, describe, expect, it } from "vitest"
import QscoreQueryController from "controllers/qscore_query_controller"
import { CaseScoreStore } from "stores/case_score_store"

/**
 * First store-subscriber Stimulus controller (docs/todo/angularjs_removal_inventory.md
 * § Re-render mechanism, step 4) — replaces the Angular <qscore-query> component's
 * primary "current query score" usage in searchResults.html. The component's
 * Karma coverage (spec/javascripts/angular/components/qscore_components_spec.js)
 * still applies to the Angular <qscore-query>'s remaining usage (diff/snapshot
 * searcher scores), which this controller doesn't touch.
 */
function buildController(element, { queryId = "1" } = {}) {
  const controller = Object.create(QscoreQueryController.prototype)
  controller.element = element
  controller.valueTarget = element.querySelector('[data-qscore-query-target="value"]')
  controller.queryIdValue = queryId
  return controller
}

describe("QscoreQueryController", () => {
  let element
  let valueEl
  let store

  beforeEach(() => {
    element = document.createElement("div")
    valueEl = document.createElement("span")
    valueEl.dataset.qscoreQueryTarget = "value"
    element.appendChild(valueEl)
    document.body.appendChild(element)

    store = new CaseScoreStore()
    window.quepidStore = { scoring: store }
  })

  afterEach(() => {
    element.remove()
    delete window.quepidStore
  })

  it("renders '?' with the unscored color before the store has any data", () => {
    const controller = buildController(element)
    QscoreQueryController.prototype.initialize.call(controller)
    QscoreQueryController.prototype.connect.call(controller)

    expect(valueEl.textContent).toBe("?")
    expect(element.style.backgroundColor).toBe("hsl(0, 0%, 0%, 0.5)")
  })

  it("renders the formatted score and color once the store has this query's score", () => {
    store.setLatestScoreInfo({
      allRated: true,
      score:    75,
      queries:  { 1: { score: 75, maxScore: 100, text: "q1", numFound: 10 } }
    })

    const controller = buildController(element)
    QscoreQueryController.prototype.initialize.call(controller)
    QscoreQueryController.prototype.connect.call(controller)

    expect(valueEl.textContent).toBe("75.00")
    expect(element.style.backgroundColor).not.toBe("")
  })

  it("re-renders when the store emits 'change' after connect", () => {
    const controller = buildController(element)
    QscoreQueryController.prototype.initialize.call(controller)
    QscoreQueryController.prototype.connect.call(controller)

    expect(valueEl.textContent).toBe("?")

    store.setLatestScoreInfo({
      allRated: true,
      score:    50,
      queries:  { 1: { score: 42, maxScore: 100, text: "q1", numFound: 3 } }
    })

    expect(valueEl.textContent).toBe("42.00")
  })

  it("stops reacting to store changes after disconnect", () => {
    const controller = buildController(element)
    QscoreQueryController.prototype.initialize.call(controller)
    QscoreQueryController.prototype.connect.call(controller)
    QscoreQueryController.prototype.disconnect.call(controller)

    store.setLatestScoreInfo({
      allRated: true,
      score:    50,
      queries:  { 1: { score: 42, maxScore: 100, text: "q1", numFound: 3 } }
    })

    expect(valueEl.textContent).toBe("?")
  })

  it("colors relative to this query's own maxScore from the store, not a fixed default", () => {
    // A 1.0-scale scorer (e.g. AP@10): a near-perfect score should read as a
    // high (green) hue, not a low one — it would look wrong if this used a
    // 100-point default scale instead of the store's actual per-query maxScore.
    store.setLatestScoreInfo({
      allRated: true,
      score:    0.9,
      queries:  { 1: { score: 0.9, maxScore: 1, text: "q1", numFound: 10 } }
    })

    const controller = buildController(element)
    QscoreQueryController.prototype.initialize.call(controller)
    QscoreQueryController.prototype.connect.call(controller)

    expect(valueEl.textContent).toBe("0.90")
    // hsl(90, 85%, 40%) is the top-of-scale-adjacent green step; a maxScore
    // of 100 instead of 1 would put 0.9 at the bottom (red) end instead.
    expect(element.style.backgroundColor).toBe("hsl(90, 85%, 40%)")
  })

  it("re-renders when queryIdValue changes (Stimulus valueChanged callback)", () => {
    store.setLatestScoreInfo({
      allRated: true,
      score:    50,
      queries:  {
        1: { score: 42, maxScore: 100, text: "q1", numFound: 3 },
        2: { score: 88, maxScore: 100, text: "q2", numFound: 5 }
      }
    })

    const controller = buildController(element)
    QscoreQueryController.prototype.initialize.call(controller)
    QscoreQueryController.prototype.connect.call(controller)
    expect(valueEl.textContent).toBe("42.00")

    controller.queryIdValue = "2"
    QscoreQueryController.prototype.queryIdValueChanged.call(controller)

    expect(valueEl.textContent).toBe("88.00")
  })
})
