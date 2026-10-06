import { buildControllerFixture } from "../support/controller_fixture"
import coreFlash from "utils/core_flash"
import { beforeEach, describe, expect, it, vi } from "vitest"
import QueryOptionsCoreController from "controllers/query_options_core_controller"
import { apiFetch } from "api/fetch"
import { getOrCreateBsModal } from "utils/bs_modal"

vi.mock("utils/core_flash", () => ({ default: { show: vi.fn(), hide: vi.fn() } }))
beforeEach(() => {
  coreFlash.show = vi.fn()
  coreFlash.hide = vi.fn()
})

vi.mock("api/fetch", () => ({ apiFetch: vi.fn() }))
vi.mock("modules/editor", () => ({
  fromTextArea: vi.fn(() => ({
    getValue: vi.fn(() => "{\"boost\": 2}"),
    setValue: vi.fn()
  }))
}))
vi.mock("utils/core_capability_access", () => ({ getCoreCapabilities: vi.fn(() => ({ queryCapabilities: { getQuery: liveQuery } })) }))
const liveQuery = vi.fn()
vi.mock("utils/bs_modal", () => ({
  getOrCreateBsModal: vi.fn(() => ({ hide: vi.fn() })),
  hideBsModal: vi.fn((modal) => modal?.hide()),
  showBsModal: vi.fn()
}))

function controller() {
  const instance = buildControllerFixture(QueryOptionsCoreController, {
    element: document.createElement("div"),
    targets: {
      saveButton: { disabled: false }
    },
    overrides: {
      editor: { getValue: vi.fn(() => '{"boost": 2}'), setValue: vi.fn() },
      saveUrl: "api/cases/1/queries/2/options",
      queryId: "2"
    }
  })
  return instance
}

describe("QueryOptionsCoreController", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(coreFlash, { show: vi.fn() })
    document.body.innerHTML = '<div id="queryOptionsModal"></div>'
  })

  it("rejects invalid JSON without saving or closing", async () => {
    const instance = controller()
    instance.editor.getValue.mockReturnValue("not json")

    await instance.save({ preventDefault: vi.fn() })

    expect(apiFetch).not.toHaveBeenCalled()
    expect(coreFlash.show).toHaveBeenCalledWith("error", "Please provide a valid JSON object.")
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
    expect(coreFlash.show).toHaveBeenCalledWith("success", "Query options saved successfully.")
    expect(getOrCreateBsModal).toHaveBeenCalledWith(instance.element)
    document.removeEventListener("query-options:saved", saved)
  })

  it("flashes the legacy failure message and re-enables save", async () => {
    const instance = controller()
    apiFetch.mockResolvedValue(new Response("", { status: 500 }))

    await instance.save({ preventDefault: vi.fn() })

    expect(coreFlash.show).toHaveBeenCalledWith("error", "Unable to save query options.")
    expect(instance.saveButtonTarget.disabled).toBe(false)
  })

  it("loads the clicked row's query and its current options when the modal opens", async () => {
    const { showBsModal } = await import("utils/bs_modal")
    const instance = controller()
    instance.saveUrlTemplateValue = "/api/cases/1/queries/__QUERY_ID__/options"
    instance.hasTitleTarget = true
    instance.titleTarget = { textContent: "" }
    instance.saveButtonTarget.disabled = true
    liveQuery.mockReturnValue({ options: { boost: 2 } })
    const row = document.createElement("li")
    row.dataset.queryId = "7"
    const button = row.appendChild(document.createElement("button"))

    instance.openFor(button)

    expect(liveQuery).toHaveBeenCalledWith("7")
    expect(instance.queryId).toBe("7")
    expect(instance.saveUrl).toBe("/api/cases/1/queries/7/options")
    expect(instance.editor.setValue).toHaveBeenCalledWith('{\n  "boost": 2\n}')
    expect(instance.titleTarget.textContent).toBe("Query Options")
    expect(instance.saveButtonTarget.disabled).toBe(false)
    // Bootstrap is already showing the modal; opening must not show it again.
    expect(showBsModal).not.toHaveBeenCalled()
  })

  it("shows {} for a query without options, and saves nowhere without a row", () => {
    const instance = controller()
    instance.saveUrlTemplateValue = "/api/cases/1/queries/__QUERY_ID__/options"
    liveQuery.mockReturnValue(undefined)

    instance.openFor(document.createElement("button"))

    expect(instance.editor.setValue).toHaveBeenCalledWith("{}")
    expect(instance.saveUrl).toBe("")
  })

  it("does not save without an editor or a save URL", async () => {
    const instance = controller()
    instance.saveUrl = ""

    await instance.save({ preventDefault: vi.fn() })

    expect(apiFetch).not.toHaveBeenCalled()
  })

  it.each([200, 500])("keeps a reopened query untouched when the original save returns %s", async (status) => {
    const instance = controller()
    instance.saveUrlTemplateValue = "api/cases/1/queries/__QUERY_ID__/options"
    let finish
    apiFetch.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const saved = vi.fn()
    document.addEventListener("query-options:saved", saved)
    const pending = instance.save({ preventDefault: vi.fn() })
    const row = document.createElement("div")
    row.dataset.queryId = "3"
    instance.openFor(row.appendChild(document.createElement("button")))
    instance.saveButtonTarget.disabled = true // B may have its own pending save.

    finish(new Response("{}", { status }))
    await pending

    if (status === 200) {
      expect(saved).toHaveBeenCalledWith(expect.objectContaining({ detail: { queryId: "2", options: { boost: 2 } } }))
    } else {
      expect(saved).not.toHaveBeenCalled()
    }
    expect(getOrCreateBsModal).not.toHaveBeenCalled()
    expect(coreFlash.show).not.toHaveBeenCalled()
    expect(instance.saveButtonTarget.disabled).toBe(true)
    document.removeEventListener("query-options:saved", saved)
  })

  it("does not submit the same opening twice while pending", async () => {
    const instance = controller()
    let finish
    apiFetch.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const pending = instance.save({ preventDefault: vi.fn() })
    await instance.save({ preventDefault: vi.fn() })
    expect(apiFetch).toHaveBeenCalledTimes(1)
    finish(new Response("{}"))
    await pending
  })
})
