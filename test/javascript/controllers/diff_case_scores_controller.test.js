import { afterEach, beforeEach, describe, expect, it } from "vitest"
import DiffCaseScoresController from "controllers/diff_case_scores_controller"
import { QueryDocumentsStore } from "stores/query_documents_store"

describe("DiffCaseScoresController", () => {
  let element
  let store

  beforeEach(() => {
    element = document.createElement("div")
    store = new QueryDocumentsStore()
    window.quepidStore = { documents: store }
  })

  afterEach(() => {
    delete window.quepidStore
  })

  it("renders case-level snapshot scores from the document store", () => {
    store.setCaseDiffs([
      { name: "Baseline", score: { score: 0.75, maxScore: 1 } },
      { name: "Tuned", score: { score: "--", maxScore: 1 } }
    ])

    const controller = Object.create(DiffCaseScoresController.prototype)
    controller.element = element
    controller.connect()

    expect(element.querySelectorAll(".case-score")).toHaveLength(2)
    expect(element.textContent).toContain("0.75")
    expect(element.textContent).toContain("Baseline")
    expect(element.textContent).toContain("Tuned")
    expect(element.querySelectorAll(".scorable-score")[1].textContent).toBe("--")
  })

  it("keeps existing score elements as direct siblings", () => {
    const primary = document.createElement("div")
    primary.className = "case-score"
    element.append(primary)

    store.setCaseDiffs([{ name: "Baseline", score: { score: 0.75 } }])

    const controller = Object.create(DiffCaseScoresController.prototype)
    controller.element = element
    controller.connect()

    expect(element.children[0]).toBe(primary)
    expect(element.children[1].classList.contains("case-score")).toBe(true)
    expect(element.children[1].dataset.diffCaseScoresGenerated).toBe("true")
  })

  it("removes the badges when comparisons are cleared", () => {
    const controller = Object.create(DiffCaseScoresController.prototype)
    controller.element = element
    controller.connect()

    store.setCaseDiffs([{ name: "Baseline", score: { score: 0.75 } }])
    expect(element.querySelectorAll(".case-score")).toHaveLength(1)

    store.clearCaseDiffs()
    expect(element.querySelectorAll(".case-score")).toHaveLength(0)
  })

  it("removes the badges when the document store resets", () => {
    const controller = Object.create(DiffCaseScoresController.prototype)
    controller.element = element
    controller.connect()

    store.setCaseDiffs([{ name: "Baseline", score: { score: 0.75 } }])
    expect(element.querySelectorAll(".case-score")).toHaveLength(1)

    store.reset()
    expect(element.querySelectorAll(".case-score")).toHaveLength(0)
  })

  it("unsubscribes on disconnect", () => {
    const controller = Object.create(DiffCaseScoresController.prototype)
    controller.element = element
    controller.connect()
    controller.disconnect()

    store.setCaseDiffs([{ name: "Baseline", score: { score: 0.75 } }])
    expect(element.querySelectorAll(".case-score")).toHaveLength(0)
  })
})
