import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { submitDestructiveForm } from "utils/destructive_form"
import ConfirmDeleteController from "./confirm_delete_controller"

vi.mock("utils/destructive_form", () => ({
  submitDestructiveForm: vi.fn()
}))

vi.mock("utils/bs_modal", () => ({
  createBsModal: vi.fn(() => null)
}))

function buildController() {
  const controller = Object.create(ConfirmDeleteController.prototype)
  controller.element = document.createElement("a")
  controller.urlValue = "/cases/5"
  controller.methodValue = "delete"
  controller.messageValue = "Delete this case?"
  controller.modal = document.createElement("div")
  controller.messageEl = document.createElement("p")
  controller.confirmBtn = document.createElement("button")
  controller.modal.appendChild(controller.messageEl)
  controller.modal.appendChild(controller.confirmBtn)
  controller._onConfirm = ConfirmDeleteController.prototype._onConfirm.bind(controller)
  controller._onModalHidden = ConfirmDeleteController.prototype._onModalHidden.bind(controller)
  return controller
}

describe("ConfirmDeleteController", () => {
  let confirmSpy

  beforeEach(() => {
    vi.clearAllMocks()
    confirmSpy = vi.spyOn(window, "confirm")
  })

  afterEach(() => {
    confirmSpy.mockRestore()
  })

  it("falls back to window.confirm and submits via the shared destructive-form helper when accepted", () => {
    confirmSpy.mockReturnValue(true)
    const controller = buildController()

    controller.open({ preventDefault: () => {} })

    expect(confirmSpy).toHaveBeenCalledWith("Delete this case?")
    expect(submitDestructiveForm).toHaveBeenCalledWith("/cases/5", "delete")
  })

  it("does not submit when the fallback confirm is dismissed", () => {
    confirmSpy.mockReturnValue(false)
    const controller = buildController()

    controller.open({ preventDefault: () => {} })

    expect(submitDestructiveForm).not.toHaveBeenCalled()
  })

  it("_submitDeleteForm delegates url/method to the shared destructive-form helper", () => {
    const controller = buildController()
    controller.currentUrl = "/cases/5"
    controller.currentMethod = "delete"

    controller._submitDeleteForm()

    expect(submitDestructiveForm).toHaveBeenCalledWith("/cases/5", "delete")
  })
})
