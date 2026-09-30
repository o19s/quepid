import { describe, expect, it } from "vitest"
import JudgeDocumentsModalController from "controllers/judge_documents_modal_controller"

function buildController(checked) {
  const controller = Object.create(JudgeDocumentsModalController.prototype)
  controller.judgeAllTarget = { checked }
  controller.submitButtonTarget = { value: "" }
  return controller
}

describe("JudgeDocumentsModalController", () => {
  it("labels the button 'Judge Documents' on connect when judge-all is off", () => {
    const controller = buildController(false)
    controller.connect()
    expect(controller.submitButtonTarget.value).toBe("Judge Documents")
  })

  it("labels the button 'Unleash the Kraken!!' on connect when judge-all is already on", () => {
    const controller = buildController(true)
    controller.connect()
    expect(controller.submitButtonTarget.value).toBe("Unleash the Kraken!!")
  })

  it("flips the label back and forth as the checkbox toggles", () => {
    const controller = buildController(false)
    controller.judgeAllTarget.checked = true
    controller.updateLabel()
    expect(controller.submitButtonTarget.value).toBe("Unleash the Kraken!!")
    controller.judgeAllTarget.checked = false
    controller.updateLabel()
    expect(controller.submitButtonTarget.value).toBe("Judge Documents")
  })
})
