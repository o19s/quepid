import { afterEach, describe, expect, it, vi } from "vitest"
import BrowseQueryController from "controllers/browse_query_controller"
import { copyText } from "utils/clipboard"
import { buildControllerFixture } from "../support/controller_fixture"

vi.mock("utils/clipboard", () => ({ copyText: vi.fn() }))

function owner() {
  const modal = document.createElement("div")
  modal.className = "modal"
  modal.innerHTML = `<div><i data-modal-target="copyIcon" class="bi bi-copy"></i><span data-modal-target="copyLabel">Copy curl command</span></div>`
  const controller = buildControllerFixture(BrowseQueryController, {
    element: modal.firstElementChild,
    values: { modalRoot: true, command: "curl 'https://example.test'" }
  })
  controller.connect()
  return { modal, controller }
}

describe("BrowseQueryController modal lifecycle", () => {
  afterEach(() => vi.clearAllMocks())

  it("copies the command and preserves the existing success feedback", async () => {
    copyText.mockResolvedValue()
    const { controller } = owner()
    await controller.copy()
    expect(copyText).toHaveBeenCalledWith("curl 'https://example.test'")
    expect(controller.element.textContent).toBe("Copied!")
    controller.disconnect()
  })

  it.each(["hide", "disconnect"])("ignores clipboard completion after %s and a new connection", async action => {
    let complete
    copyText.mockImplementation(() => new Promise(resolve => { complete = resolve }))
    const { modal, controller } = owner()
    const pending = controller.copy()
    if (action === "hide") modal.dispatchEvent(new Event("hide.bs.modal"))
    controller.disconnect()
    controller.connect()
    complete()
    await pending
    expect(controller.element.textContent).toBe("Copy curl command")
    controller.disconnect()
  })

  it("retains the existing silent clipboard failure behavior", async () => {
    copyText.mockRejectedValue(new Error("denied"))
    const { controller } = owner()
    await controller.copy()
    expect(controller.element.textContent).toBe("Copy curl command")
    controller.disconnect()
  })
})
