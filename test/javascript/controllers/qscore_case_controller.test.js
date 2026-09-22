import { afterEach, beforeEach, describe, expect, it } from "vitest"
import QscoreCaseController from "controllers/qscore_case_controller"
import { CaseScoreStore } from "stores/case_score_store"

/**
 * Store-driven Stimulus controller for the Angular <qscore-case> component's
 * primary "current case score" usage (docs/todo/angularjs_removal_inventory.md
 * § Re-render mechanism, step 4) — same pattern as
 * qscore_query_controller.test.js. The component's Karma coverage
 * (spec/javascripts/angular/components/qscore_components_spec.js) still applies
 * to the Angular <qscore-case>'s remaining usage (snapshot/diff searcher
 * scores), which this controller doesn't touch.
 */
function buildController(element, { caseId = 1, scoreLabel = "AP@10" } = {}) {
  const controller = Object.create(QscoreCaseController.prototype)
  controller.element = element
  controller.valueTarget = element.querySelector('[data-qscore-case-target="value"]')
  controller.labelTarget = element.querySelector('[data-qscore-case-target="label"]')
  controller.hasLabelTarget = !!controller.labelTarget
  controller.caseIdValue = caseId
  controller.scoreLabelValue = scoreLabel
  return controller
}

describe("QscoreCaseController", () => {
  let element
  let valueEl
  let labelEl
  let store

  beforeEach(() => {
    element = document.createElement("div")
    valueEl = document.createElement("span")
    valueEl.dataset.qscoreCaseTarget = "value"
    labelEl = document.createElement("span")
    labelEl.dataset.qscoreCaseTarget = "label"
    element.appendChild(valueEl)
    element.appendChild(labelEl)
    document.body.appendChild(element)

    store = new CaseScoreStore()
    window.quepidStore = { scoring: store }
  })

  afterEach(() => {
    element.remove()
    delete window.quepidStore
  })

  it("renders '?' with the unscored color and the server-rendered label before the store has any data", () => {
    const controller = buildController(element)
    QscoreCaseController.prototype.initialize.call(controller)
    QscoreCaseController.prototype.connect.call(controller)

    expect(valueEl.textContent).toBe("?")
    expect(element.style.backgroundColor).toBe("hsl(0, 0%, 0%, 0.5)")
    expect(labelEl.textContent).toBe("AP@10")
  })

  it("renders the formatted score and color once the store has a case score", () => {
    store.setLatestScoreInfo({
      allRated: true,
      score:    0.9,
      queries:  { 1: { score: 0.9, maxScore: 1, text: "q1", numFound: 10 } }
    })

    const controller = buildController(element)
    QscoreCaseController.prototype.initialize.call(controller)
    QscoreCaseController.prototype.connect.call(controller)

    expect(valueEl.textContent).toBe("0.90")
    // hsl(90, 85%, 40%) is the top-of-scale-adjacent green step for a 1.0-scale
    // scorer's caseScore.maxScore, not a fixed 100-point default.
    expect(element.style.backgroundColor).toBe("hsl(90, 85%, 40%)")
  })

  it("re-renders when the store emits 'change' after connect", () => {
    const controller = buildController(element)
    QscoreCaseController.prototype.initialize.call(controller)
    QscoreCaseController.prototype.connect.call(controller)

    expect(valueEl.textContent).toBe("?")

    store.setLatestScoreInfo({
      allRated: true,
      score:    0.5,
      queries:  { 1: { score: 0.5, maxScore: 1, text: "q1", numFound: 3 } }
    })

    expect(valueEl.textContent).toBe("0.50")
  })

  it("stops reacting to store changes after disconnect", () => {
    const controller = buildController(element)
    QscoreCaseController.prototype.initialize.call(controller)
    QscoreCaseController.prototype.connect.call(controller)
    QscoreCaseController.prototype.disconnect.call(controller)

    store.setLatestScoreInfo({
      allRated: true,
      score:    0.5,
      queries:  { 1: { score: 0.5, maxScore: 1, text: "q1", numFound: 3 } }
    })

    expect(valueEl.textContent).toBe("?")
  })

  it("updates the label when pick-scorer:selected fires for this case", () => {
    const controller = buildController(element, { caseId: 7, scoreLabel: "AP@10" })
    QscoreCaseController.prototype.initialize.call(controller)
    QscoreCaseController.prototype.connect.call(controller)

    document.dispatchEvent(
      new CustomEvent("pick-scorer:selected", {
        detail: { caseId: 7, scorer: { name: "NDCG@10" } }
      })
    )

    expect(labelEl.textContent).toBe("NDCG@10")
  })

  it("ignores pick-scorer:selected for a different case", () => {
    const controller = buildController(element, { caseId: 7, scoreLabel: "AP@10" })
    QscoreCaseController.prototype.initialize.call(controller)
    QscoreCaseController.prototype.connect.call(controller)

    document.dispatchEvent(
      new CustomEvent("pick-scorer:selected", {
        detail: { caseId: 99, scorer: { name: "NDCG@10" } }
      })
    )

    expect(labelEl.textContent).toBe("AP@10")
  })

  it("stops reacting to pick-scorer:selected after disconnect", () => {
    const controller = buildController(element, { caseId: 7, scoreLabel: "AP@10" })
    QscoreCaseController.prototype.initialize.call(controller)
    QscoreCaseController.prototype.connect.call(controller)
    QscoreCaseController.prototype.disconnect.call(controller)

    document.dispatchEvent(
      new CustomEvent("pick-scorer:selected", {
        detail: { caseId: 7, scorer: { name: "NDCG@10" } }
      })
    )

    expect(labelEl.textContent).toBe("AP@10")
  })
})
