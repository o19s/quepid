import { buildControllerFixture } from "../support/controller_fixture"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getOrCreateBsModal } from "utils/bs_modal"
import ConfirmDialogController from "controllers/confirm_dialog_controller"

vi.mock("utils/bs_modal", () => ({ getOrCreateBsModal: vi.fn() }))

const message = "Archive this case?"
function buildController() {
  const controller = buildControllerFixture(ConfirmDialogController, {
    element: document.createElement("div"),
    targets: {
      message: document.createElement("p"),
      accept: Object.assign(document.createElement("button"), { className: "btn btn-danger" })
    }
  })
  return controller
}

describe("ConfirmDialogController", () => {
  let modal
  beforeEach(() => {
    vi.clearAllMocks()
    modal = { show: vi.fn(), hide: vi.fn(), dispose: vi.fn() }
    getOrCreateBsModal.mockReturnValue(modal)
    vi.stubGlobal("confirm", vi.fn())
  })
  afterEach(() => vi.unstubAllGlobals())

  it("shows the message and accepts exactly once when confirmed", async () => {
    const controller = buildController()
    const answer = controller.ask(message)
    expect(controller.messageTarget.textContent).toBe(message)
    expect(modal.show).toHaveBeenCalledOnce()
    controller.confirm({ preventDefault: vi.fn() })
    controller.confirm({ preventDefault: vi.fn() })
    await expect(answer).resolves.toBe(true)
    expect(modal.hide).toHaveBeenCalledOnce()
  })

  it("declines when the modal closes without Confirm", async () => {
    const controller = buildController()
    const answer = controller.ask(message)
    controller.clear()
    await expect(answer).resolves.toBe(false)
    controller.confirm({ preventDefault: vi.fn() })
    expect(modal.hide).not.toHaveBeenCalled()
  })

  it("declines a pending question when the next one is asked", async () => {
    const controller = buildController()
    const first = controller.ask(message)
    const second = controller.ask("Remove member?")
    await expect(first).resolves.toBe(false)
    expect(controller.messageTarget.textContent).toBe("Remove member?")
    controller.confirm({ preventDefault: vi.fn() })
    await expect(second).resolves.toBe(true)
  })

  it("disposes the modal and declines a pending question on disconnect", async () => {
    const controller = buildController()
    const answer = controller.ask(message)
    controller.disconnect()
    expect(modal.dispose).toHaveBeenCalledOnce()
    await expect(answer).resolves.toBe(false)
  })

  it.each(["show", "hide"])("waits for an in-flight %s transition before disposing", (phase) => {
    const controller = buildController()
    controller.ask(message)
    controller.transition({ type: `${phase}.bs.modal` })
    controller.disconnect()
    expect(modal.dispose).not.toHaveBeenCalled()
    document.body.appendChild(controller.element)
    controller.element.dispatchEvent(
      new Event(phase === "show" ? "shown.bs.modal" : "hidden.bs.modal")
    )
    expect(modal.dispose).toHaveBeenCalledOnce()
    expect(controller.element.isConnected).toBe(false)
  })

  describe("focus return", () => {
    afterEach(() => {
      document.body.innerHTML = ""
    })

    function focusedButton() {
      const button = document.body.appendChild(document.createElement("button"))
      button.focus()
      return button
    }

    it("returns focus to the original opener, even after a re-ask", () => {
      const opener = focusedButton()
      const controller = buildController()
      document.body.appendChild(controller.element)
      controller.ask(message)
      controller.messageTarget.tabIndex = -1
      controller.element.appendChild(controller.messageTarget).focus()

      controller.ask("Remove member?")
      controller.restoreFocus()

      expect(document.activeElement).toBe(opener)
    })

    it("leaves focus alone when the opener has been removed", () => {
      const opener = focusedButton()
      const controller = buildController()
      controller.ask(message)
      opener.remove()
      const elsewhere = focusedButton()

      controller.restoreFocus()

      expect(document.activeElement).toBe(elsewhere)
    })
  })

  it.each([
    [undefined, "btn-danger"],
    ["primary", "btn-primary"],
    ["danger", "btn-danger"],
    ["bogus", "btn-danger"]
  ])("colours Confirm for style %s", (style, expected) => {
    const controller = buildController()
    controller.ask(message, "primary")
    controller.ask(message, style)
    const classes = [...controller.acceptTarget.classList].filter((name) =>
      /^btn-(danger|primary)$/.test(name)
    )
    expect(classes).toEqual([expected])
  })

  it.each([true, false])("falls back to native confirmation when accepted=%s", async (accepted) => {
    getOrCreateBsModal.mockReturnValue(null)
    window.confirm.mockReturnValue(accepted)
    const controller = buildController()
    await expect(controller.ask(message)).resolves.toBe(accepted)
    expect(window.confirm).toHaveBeenCalledWith(message)
  })
})
