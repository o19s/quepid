import { describe, expect, it } from "vitest"
import ModalTriggerControllerBase from "controllers/core_modal_trigger_controller_base"

function buildController() {
  const controller = Object.create(ModalTriggerControllerBase.prototype)
  controller.hasAlertTarget = true
  controller.alertTarget = document.createElement("div")
  return controller
}

describe("ModalTriggerControllerBase alert helpers", () => {
  it("renders alert messages as text and applies the requested variant", () => {
    const controller = buildController()

    controller.showAlert("<script>alert(1)</script>", "danger")

    expect(controller.alertTarget.textContent).toBe("<script>alert(1)</script>")
    expect(controller.alertTarget.innerHTML).not.toContain("<script>")
    expect(controller.alertTarget.className).toBe("alert alert-danger")
  })

  it("clears and hides the alert", () => {
    const controller = buildController()
    controller.showAlert("Try again", "warning")

    controller.clearAlert()

    expect(controller.alertTarget.textContent).toBe("")
    expect(controller.alertTarget.className).toBe("alert d-none")
  })

  it("does nothing when the controller has no alert target", () => {
    const controller = Object.create(ModalTriggerControllerBase.prototype)
    controller.hasAlertTarget = false

    expect(() => controller.showAlert("Message", "danger")).not.toThrow()
    expect(() => controller.clearAlert()).not.toThrow()
  })
})
