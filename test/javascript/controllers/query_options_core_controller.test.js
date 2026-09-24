import { beforeEach, describe, expect, it, vi } from "vitest"
import QueryOptionsCoreController from "controllers/query_options_core_controller"
import { apiFetch } from "api/fetch"

vi.mock("api/fetch", () => ({ apiFetch: vi.fn() }))
vi.mock("modules/editor", () => ({
  fromTextArea: vi.fn(() => ({
    getValue: vi.fn(() => "{\"boost\": 2}"),
    setValue: vi.fn()
  }))
}))
vi.mock("utils/bs_modal", () => ({
  getOrCreateBsModal: vi.fn(() => ({ hide: vi.fn() })),
  showBsModal: vi.fn()
}))

function controller() {
  const instance = Object.create(QueryOptionsCoreController.prototype)
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
    document.removeEventListener("query-options:saved", saved)
  })

  it("flashes the legacy failure message and re-enables save", async () => {
    const instance = controller()
    apiFetch.mockResolvedValue(new Response("", { status: 500 }))

    await instance.save({ preventDefault: vi.fn() })

    expect(window.quepidDom.flash.show).toHaveBeenCalledWith("error", "Unable to save query options.")
    expect(instance.saveButtonTarget.disabled).toBe(false)
  })
})
