import { describe, expect, it } from "vitest"
import DiffScoreController from "controllers/diff_score_controller"

describe("DiffScoreController", () => {
  it("renders a diff score from the document store", () => {
    const element = document.createElement("div")
    element.innerHTML = '<span data-diff-score-target="value"></span>'
    const controller = Object.create(DiffScoreController.prototype)
    controller.element = element
    controller.valueTarget = element.querySelector("span")
    controller.hasValueTarget = true
    controller.queryIdValue = "1"
    controller.indexValue = 0
    controller.store = {
      query: () => ({ diffs: { searchers: [{ score: { score: 0.5 } }] } })
    }

    controller.render()

    expect(controller.valueTarget.textContent).toBe("0.50")
    expect(controller.element.style.backgroundColor).toContain("hsl")
  })

  it("renders an unscored state when the diff is not ready", () => {
    const element = document.createElement("div")
    element.innerHTML = '<span data-diff-score-target="value"></span>'
    const controller = Object.create(DiffScoreController.prototype)
    controller.element = element
    controller.valueTarget = element.querySelector("span")
    controller.hasValueTarget = true
    controller.queryIdValue = "1"
    controller.indexValue = 0
    controller.store = { query: () => ({ diffs: { searchers: [] } }) }

    controller.render()

    expect(controller.valueTarget.textContent).toBe("?")
  })
})
