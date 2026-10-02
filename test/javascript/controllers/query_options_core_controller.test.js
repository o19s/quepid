import { beforeEach, describe, expect, it, vi } from "vitest"
import QueryOptionsCoreController from "controllers/query_options_core_controller"
import { apiFetch } from "api/fetch"
import { getOrCreateBsModal } from "utils/bs_modal"

vi.mock("api/fetch", () => ({ apiFetch: vi.fn() }))
vi.mock("modules/editor", () => ({
  fromTextArea: vi.fn(() => ({
    getValue: vi.fn(() => "{\"boost\": 2}"),
    setValue: vi.fn()
  }))
}))
vi.mock("utils/bs_modal", () => ({
  getOrCreateBsModal: vi.fn(() => ({ hide: vi.fn() })),
  hideBsModal: vi.fn((modal) => modal?.hide()),
  showBsModal: vi.fn()
}))

function controller() {
  const instance = Object.create(QueryOptionsCoreController.prototype)
  instance.element = document.createElement("div")
  instance.editor = { getValue: vi.fn(() => '{"boost": 2}'), setValue: vi.fn() }
  instance.hasSaveButtonTarget = true
  instance.saveButtonTarget = { disabled: false }
  instance.saveUrl = "api/cases/1/queries/2/options"
  instance.queryId = "2"
  return instance
}

describe("QueryOptionsCoreController", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.quepidDom = { flash: { show: vi.fn() } }
    document.body.innerHTML = '<div id="queryOptionsModal"></div>'
  })

  it("rejects invalid JSON without saving or closing", async () => {
    const instance = controller()
    instance.editor.getValue.mockReturnValue("not json")

    await instance.save({ preventDefault: vi.fn() })

    expect(apiFetch).not.toHaveBeenCalled()
    expect(window.quepidDom.flash.show).toHaveBeenCalledWith("error", "Please provide a valid JSON object.")
  })

  it("saves options, flashes success, and dispatches the scoring bridge event", async () => {
    const instance = controller()
    const saved = vi.fn()
    document.addEventListener("query-options:saved", saved)
    apiFetch.mockResolvedValue(new Response("{}", { status: 200 }))

    await instance.save({ preventDefault: vi.fn() })

    expect(apiFetch).toHaveBeenCalledWith(instance.saveUrl, expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({ query: { options: { boost: 2 } } })
    }))
    expect(saved).toHaveBeenCalledWith(expect.objectContaining({
      detail: { queryId: "2", options: { boost: 2 } }
    }))
    expect(window.quepidDom.flash.show).toHaveBeenCalledWith("success", "Query options saved successfully.")
    expect(getOrCreateBsModal).toHaveBeenCalledWith(instance.element)
    document.removeEventListener("query-options:saved", saved)
  })

  it("flashes the legacy failure message and re-enables save", async () => {
    const instance = controller()
    apiFetch.mockResolvedValue(new Response("", { status: 500 }))

    await instance.save({ preventDefault: vi.fn() })

    expect(window.quepidDom.flash.show).toHaveBeenCalledWith("error", "Unable to save query options.")
    expect(instance.saveButtonTarget.disabled).toBe(false)
  })

  it("loads the clicked query and its options pretty-printed when the modal opens", async () => {
    const { showBsModal } = await import("utils/bs_modal")
    const instance = controller()
    instance.hasTitleTarget = true
    instance.titleTarget = { textContent: "" }
    instance.saveButtonTarget.disabled = true
    const button = document.createElement("button")
    button.dataset.queryOptionsCoreQueryIdValue = "7"
    button.dataset.queryOptionsCoreSaveUrlValue = "api/cases/1/queries/7/options"
    button.dataset.queryOptionsCoreOptionsValue = '{"boost":2}'

    instance.openFor(button)

    expect(instance.queryId).toBe("7")
    expect(instance.saveUrl).toBe("api/cases/1/queries/7/options")
    expect(instance.editor.setValue).toHaveBeenCalledWith('{\n  "boost": 2\n}')
    expect(instance.titleTarget.textContent).toBe("Query Options")
    expect(instance.saveButtonTarget.disabled).toBe(false)
    // Bootstrap is already showing the modal; opening must not show it again.
    expect(showBsModal).not.toHaveBeenCalled()
  })

  it("shows empty options as {} and leaves unparseable stored options as-is", () => {
    const instance = controller()

    expect(instance.formatOptions(undefined)).toBe("{}")
    expect(instance.formatOptions("")).toBe("{}")
    expect(instance.formatOptions("{not json")).toBe("{not json")
  })

  it("does not save without an editor or a save URL", async () => {
    const instance = controller()
    instance.saveUrl = ""

    await instance.save({ preventDefault: vi.fn() })

    expect(apiFetch).not.toHaveBeenCalled()
  })
})
