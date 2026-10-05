import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getOrCreateBsModal } from "utils/bs_modal"
import { submitDestructiveForm } from "utils/destructive_form"
import ConfirmDeleteDialogController from "controllers/confirm_delete_dialog_controller"

vi.mock("utils/destructive_form", () => ({ submitDestructiveForm: vi.fn() }))
vi.mock("utils/bs_modal", () => ({ getOrCreateBsModal: vi.fn() }))

const request = { url: "/cases/5", method: "patch", message: "Archive this case?" }
function buildController() {
  const controller = Object.create(ConfirmDeleteDialogController.prototype)
  controller.element = document.createElement("div")
  controller.messageTarget = document.createElement("p")
  return controller
}

describe("ConfirmDeleteDialogController", () => {
  let modal
  beforeEach(() => {
    vi.clearAllMocks()
    modal = { show: vi.fn(), hide: vi.fn(), dispose: vi.fn() }
    getOrCreateBsModal.mockReturnValue(modal)
    vi.stubGlobal("confirm", vi.fn())
  })
  afterEach(() => vi.unstubAllGlobals())

  it("shows the message and submits exactly once when confirmed", () => {
    const controller = buildController()
    controller.open(request)
    expect(controller.messageTarget.textContent).toBe(request.message)
    expect(modal.show).toHaveBeenCalledOnce()
    controller.confirm({ preventDefault: vi.fn() })
    controller.confirm({ preventDefault: vi.fn() })
    expect(submitDestructiveForm).toHaveBeenCalledExactlyOnceWith(request.url, request.method)
    expect(modal.hide).toHaveBeenCalledOnce()
  })

  it("cancels a pending request and uses the next trigger's settings", () => {
    const controller = buildController()
    controller.open(request)
    controller.clear()
    controller.confirm({ preventDefault: vi.fn() })
    expect(submitDestructiveForm).not.toHaveBeenCalled()
    const next = { url: "/teams/2", method: "delete", message: "Remove member?" }
    controller.open(next)
    controller.confirm({ preventDefault: vi.fn() })
    expect(submitDestructiveForm).toHaveBeenCalledExactlyOnceWith(next.url, next.method)
  })

  it("disposes the modal and clears pending state on disconnect", () => {
    const controller = buildController()
    controller.open(request)
    controller.disconnect()
    expect(modal.dispose).toHaveBeenCalledOnce()
    expect(controller.request).toBeNull()
    controller.confirm({ preventDefault: vi.fn() })
    expect(submitDestructiveForm).not.toHaveBeenCalled()
  })

  it.each(["show", "hide"])("waits for an in-flight %s transition before disposing", phase => {
    const controller = buildController()
    controller.open(request)
    controller.transition({ type: `${phase}.bs.modal` })
    controller.disconnect()
    expect(modal.dispose).not.toHaveBeenCalled()
    document.body.appendChild(controller.element)
    controller.element.dispatchEvent(new Event(phase === "show" ? "shown.bs.modal" : "hidden.bs.modal"))
    expect(modal.dispose).toHaveBeenCalledOnce()
    expect(controller.element.isConnected).toBe(false)
  })

  it.each([true, false])("preserves native confirmation fallback when accepted=%s", accepted => {
    getOrCreateBsModal.mockReturnValue(null)
    window.confirm.mockReturnValue(accepted)
    const controller = buildController()
    controller.open(request)
    expect(window.confirm).toHaveBeenCalledWith(request.message)
    if (accepted) expect(submitDestructiveForm).toHaveBeenCalledExactlyOnceWith(request.url, request.method)
    else expect(submitDestructiveForm).not.toHaveBeenCalled()
    expect(controller.request).toBeUndefined()
  })
})
