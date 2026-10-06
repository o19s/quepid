import { buildControllerFixture } from "../support/controller_fixture"
import coreFlash from "utils/core_flash"
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import QueryDeleteController from "controllers/query_delete_controller"

vi.mock("utils/core_flash", () => ({ default: { show: vi.fn(), hide: vi.fn() } }))
beforeEach(() => {
  coreFlash.show = vi.fn()
  coreFlash.hide = vi.fn()
})

describe("query-delete controller", () => {
  let controller

  beforeEach(() => {
    controller = buildControllerFixture(QueryDeleteController, {
      element: document.createElement("button"),
      values: { queryId: 42, deleteUrl: "api/cases/1/queries/42" },
      outlets: { queryCommandBridge: { queryRemoved: vi.fn() } },
      overrides: { dispatch: vi.fn() }
    })
    window.confirm = vi.fn()
    window.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("dispatches the query id after confirmation", () => {
    window.confirm.mockReturnValue(true)
    window.fetch.mockResolvedValue({ text: async () => "", json: async () => null,  ok: true })

    return controller.remove({ preventDefault: vi.fn() }).then(() => {
      expect(controller.dispatch).toHaveBeenCalledWith("completed", { target: document, detail: { queryId: 42 } })
    })
  })

  it("does not dispatch when confirmation is declined", () => {
    window.confirm.mockReturnValue(false)

    controller.remove({ preventDefault: vi.fn() })

    expect(controller.dispatch).not.toHaveBeenCalled()
  })

  it("reports a failed request without dispatching completion", async () => {
    window.confirm.mockReturnValue(true)
    window.fetch.mockResolvedValue({ text: async () => "", json: async () => null,  ok: false, status: 500 })
    controller.element = document.createElement("button")
    controller.element.disabled = false
    const flash = { show: vi.fn() }
    Object.assign(coreFlash, flash)

    await controller.remove({ preventDefault: vi.fn() })

    expect(controller.dispatch).not.toHaveBeenCalled()
    expect(controller.queryCommandBridgeOutlet.queryRemoved).not.toHaveBeenCalled()
    expect(flash.show).toHaveBeenCalledWith("error", "Unable to delete query.")

  })

  it("deletes with DELETE, disables the button while pending, and tells the live list", async () => {
    window.confirm.mockReturnValue(true)
    let resolveFetch
    window.fetch.mockReturnValue(new Promise((resolve) => { resolveFetch = resolve }))
    const event = { preventDefault: vi.fn() }

    const pending = controller.remove(event)
    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(controller.element.disabled).toBe(true)
    resolveFetch({ text: async () => "", json: async () => null,  ok: true })
    await pending

    expect(window.fetch).toHaveBeenCalledWith("api/cases/1/queries/42", expect.objectContaining({ method: "DELETE" }))
    expect(controller.queryCommandBridgeOutlet.queryRemoved).toHaveBeenCalledWith({ queryId: 42 })
    expect(controller.dispatch).toHaveBeenCalledWith("completed", { target: document, detail: { queryId: 42 } })
  })

  it("re-enables the button after a failed delete so the user can retry", async () => {
    window.confirm.mockReturnValue(true)
    window.fetch.mockResolvedValue({ text: async () => "", json: async () => null,  ok: false, status: 500 })
    vi.spyOn(console, "error").mockImplementation(() => {})

    await controller.remove({ preventDefault: vi.fn() })

    expect(controller.element.disabled).toBe(false)
  })

  it("does not request anything when declined, and reports a missing delete URL", async () => {
    window.confirm.mockReturnValue(false)
    controller.remove({ preventDefault: vi.fn() })
    expect(window.fetch).not.toHaveBeenCalled()

    const flash = { show: vi.fn() }
    Object.assign(coreFlash, flash)
    Object.defineProperty(controller, "deleteUrlValue", { configurable: true, value: "" })
    await controller.deleteQuery()
    expect(window.fetch).not.toHaveBeenCalled()
    expect(controller.element.disabled).toBe(false)
    expect(flash.show).toHaveBeenCalledWith("error", "Unable to delete query.")

  })
})
