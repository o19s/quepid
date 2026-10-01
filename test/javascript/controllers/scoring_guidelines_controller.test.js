import { describe, expect, it } from "vitest"
import ScoringGuidelinesController from "controllers/scoring_guidelines_controller"

const FOUR = "four point guidelines"
const TWO = "two point guidelines"

function buildController({ text = "", scorerId = "1", lengths = { 1: 4, 2: 2, 3: 3 } } = {}) {
  const controller = Object.create(ScoringGuidelinesController.prototype)
  controller.textareaTarget = { value: text }
  controller.fourPointValue = FOUR
  controller.twoPointValue = TWO
  controller.scorerSelectTarget = { value: scorerId }
  controller.scaleLengthsValue = lengths
  return controller
}

describe("ScoringGuidelinesController#scaleChanged", () => {
  it("fills the four-point guidelines into an empty textarea for a four-point scale", () => {
    const controller = buildController({ scorerId: "1" })
    controller.scaleChanged()
    expect(controller.textareaTarget.value).toBe(FOUR)
  })

  it("fills the two-point guidelines for a two-point scale", () => {
    const controller = buildController({ scorerId: "2" })
    controller.scaleChanged()
    expect(controller.textareaTarget.value).toBe(TWO)
  })

  it("swaps one default for the other when the scale changes", () => {
    const controller = buildController({ text: FOUR, scorerId: "2" })
    controller.scaleChanged()
    expect(controller.textareaTarget.value).toBe(TWO)
  })

  it("falls back to four-point for an empty textarea with an unusual scale length", () => {
    const controller = buildController({ scorerId: "3" })
    controller.scaleChanged()
    expect(controller.textareaTarget.value).toBe(FOUR)
  })

  it("leaves a default textarea alone for an unusual scale length", () => {
    const controller = buildController({ text: TWO, scorerId: "3" })
    controller.scaleChanged()
    expect(controller.textareaTarget.value).toBe(TWO)
  })

  it("never overwrites custom guidelines", () => {
    const controller = buildController({ text: "my own rules", scorerId: "2" })
    controller.scaleChanged()
    expect(controller.textareaTarget.value).toBe("my own rules")
  })

  it("does nothing when no scorer is selected", () => {
    const controller = buildController({ scorerId: "" })
    controller.scaleChanged()
    expect(controller.textareaTarget.value).toBe("")
  })

  it("does nothing when the scorer has no known scale length", () => {
    const controller = buildController({ scorerId: "99" })
    controller.scaleChanged()
    expect(controller.textareaTarget.value).toBe("")
  })
})
