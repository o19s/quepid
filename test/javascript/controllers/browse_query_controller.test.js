import { loadDynamicModalTemplate, controllerTargets } from "../support/view_template"
import { afterEach, describe, expect, it, vi } from "vitest"
import BrowseQueryController from "controllers/browse_query_controller"
import { copyText } from "utils/clipboard"
import { buildControllerFixture } from "../support/controller_fixture"

vi.mock("utils/clipboard", () => ({ copyText: vi.fn() }))

function owner(headers = {}) {
  const modal = document.createElement("div")
  modal.className = "modal"
  modal.innerHTML = "<div></div>"
  modal.firstElementChild.append(loadDynamicModalTemplate("browse-query-modal-template").content.cloneNode(true))
  const controller = buildControllerFixture(BrowseQueryController, {
    element: modal.firstElementChild,
    targets: controllerTargets(modal.firstElementChild, BrowseQueryController, "browse-query"),
    values: { modalRoot: true, url: "https://example.test", engineName: "Solr", headers, command: "curl 'https://example.test'" }
  })
  controller.connect()
  return { modal, controller }
}

describe("BrowseQueryController modal lifecycle", () => {
  afterEach(() => vi.clearAllMocks())

  it.each([{}, { Authorization: "Bearer example" }])("preserves header notices and direct-link visibility for %j", headers => {
    const { controller } = owner(headers)
    const hasHeaders = Object.keys(headers).length > 0
    expect(controller.headersNoticeTarget.classList.contains("d-none")).toBe(!hasHeaders)
    expect(controller.noHeadersNoticeTarget.classList.contains("d-none")).toBe(hasHeaders)
    expect(controller.directLinkTarget.classList.contains("d-none")).toBe(hasHeaders)
    expect(controller.directLinkTarget.href).toBe("https://example.test/")
    expect(controller.curlTarget.textContent).toBe("curl 'https://example.test'")
    expect(controller.engineNameTargets.every(node => node.textContent === "Solr")).toBe(true)
    controller.disconnect()
  })

  it("copies the command and preserves the existing success feedback", async () => {
    copyText.mockResolvedValue()
    const { controller } = owner()
    await controller.copy()
    expect(copyText).toHaveBeenCalledWith("curl 'https://example.test'")
    expect(controller.copyLabelTarget.textContent).toBe("Copied!")
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
    expect(controller.copyLabelTarget.textContent).toBe("Copy curl command")
    controller.disconnect()
  })

  it("retains the existing silent clipboard failure behavior", async () => {
    copyText.mockRejectedValue(new Error("denied"))
    const { controller } = owner()
    await controller.copy()
    expect(controller.copyLabelTarget.textContent).toBe("Copy curl command")
    controller.disconnect()
  })
})
