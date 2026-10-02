import { describe, expect, it, vi } from "vitest"
import CoreModalControllerBase from "controllers/core_modal_controller_base"

function buildController() {
  const controller = Object.create(CoreModalControllerBase.prototype)
  controller.hasAlertTarget = true
  controller.alertTarget = document.createElement("div")
  return controller
}

describe("CoreModalControllerBase alert helpers", () => {
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
    const controller = Object.create(CoreModalControllerBase.prototype)
    controller.hasAlertTarget = false

    expect(() => controller.showAlert("Message", "danger")).not.toThrow()
    expect(() => controller.clearAlert()).not.toThrow()
  })
})

describe("CoreModalControllerBase open", () => {
  function buildModal() {
    const controller = Object.create(CoreModalControllerBase.prototype)
    controller.element = document.createElement("div")
    controller.openFor = vi.fn(() => "opened")
    return controller
  }

  it("hands Bootstrap's relatedTarget trigger to openFor", () => {
    const controller = buildModal()
    const trigger = document.createElement("a")

    const result = controller.open({ target: controller.element, relatedTarget: trigger })

    expect(controller.openFor).toHaveBeenCalledWith(trigger)
    expect(result).toBe("opened")
  })

  it("passes null when the modal is shown without a trigger", () => {
    const controller = buildModal()

    controller.open({ target: controller.element })

    expect(controller.openFor).toHaveBeenCalledWith(null)
  })

  it("ignores show events bubbling up from a nested modal", () => {
    const controller = buildModal()

    controller.open({ target: document.createElement("div"), relatedTarget: document.createElement("a") })

    expect(controller.openFor).not.toHaveBeenCalled()
  })
})
