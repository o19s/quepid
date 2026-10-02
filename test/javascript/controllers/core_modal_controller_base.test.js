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

describe("CoreModalControllerBase modal state", () => {
  it("does not read missing Stimulus targets", () => {
    const controller = Object.create(CoreModalControllerBase.prototype)
    Object.defineProperty(controller, "progressTarget", {
      get() { throw new Error("Missing target") }
    })

    expect(() => controller.setProgress(true)).not.toThrow()
    expect(() => controller.setLoading(true)).not.toThrow()
    expect(() => controller.setSubmitting(true)).not.toThrow()
    expect(() => controller.showError("Failure")).not.toThrow()
    expect(() => controller.clearError()).not.toThrow()
  })

  it("disables submit and cancel without disabling unrelated buttons", () => {
    const controller = buildController()
    controller.hasSubmitButtonTarget = true
    controller.submitButtonTarget = document.createElement("button")
    controller.hasCancelButtonTarget = true
    controller.cancelButtonTarget = document.createElement("button")
    controller.hasUnshareButtonTarget = true
    controller.unshareButtonTarget = document.createElement("button")

    controller.setSubmitting(true)
    expect(controller.submitButtonTarget.disabled).toBe(true)
    expect(controller.cancelButtonTarget.disabled).toBe(true)
    expect(controller.unshareButtonTarget.disabled).toBe(false)

    controller.setSubmitting(false)
    expect(controller.submitButtonTarget.disabled).toBe(false)
    expect(controller.cancelButtonTarget.disabled).toBe(false)

    controller.setButtonsDisabled(true, ["unshareButton"])
    expect(controller.unshareButtonTarget.disabled).toBe(true)
    expect(controller.submitButtonTarget.disabled).toBe(false)
  })

  it("renders action errors as plain text and preserves their line break", () => {
    const controller = buildController()
    controller.hasErrorTarget = true
    controller.errorTarget = document.createElement("div")
    controller.showError("<b>Failure</b>")
    expect(controller.errorTarget.querySelector("b")).toBeNull()
    expect(controller.errorTarget.textContent).toContain("(<b>Failure</b>)")
    expect(controller.errorTarget.textContent).toContain("\nIf the error persist")
    expect(controller.errorTarget.style.whiteSpace).toBe("pre-line")

    controller.clearError()
    expect(controller.errorTarget.textContent).toBe("")
    expect(controller.errorTarget.classList.contains("d-none")).toBe(true)
  })

  it("passes external context to Bootstrap and hides the same modal", () => {
    const previous = window.bootstrap
    const modal = { show: vi.fn(), hide: vi.fn() }
    window.bootstrap = { Modal: { getOrCreateInstance: vi.fn(() => modal) } }
    try {
      const controller = buildController()
      controller.element = document.createElement("div")
      const trigger = { dataset: { caseId: "6" } }
      controller.show(trigger)
      controller.hide()
      expect(window.bootstrap.Modal.getOrCreateInstance).toHaveBeenCalledWith(controller.element, undefined)
      expect(modal.show).toHaveBeenCalledWith(trigger)
      expect(modal.hide).toHaveBeenCalledOnce()
    } finally {
      window.bootstrap = previous
    }
  })
})
