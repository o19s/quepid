import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import QueryDeleteController from "controllers/query_delete_controller"

describe("query-delete controller", () => {
  let controller

  beforeEach(() => {
    controller = new QueryDeleteController(document.createElement("button"))
    controller.element = document.createElement("button")
    Object.defineProperty(controller, "queryIdValue", { configurable: true, value: 42 })
    Object.defineProperty(controller, "hasDeleteUrlValue", { configurable: true, value: true })
    Object.defineProperty(controller, "deleteUrlValue", { configurable: true, value: "api/cases/1/queries/42" })
    controller.dispatch = vi.fn()
    window.confirm = vi.fn()
    window.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("dispatches the query id after confirmation", () => {
    window.confirm.mockReturnValue(true)
    window.fetch.mockResolvedValue({ ok: true })

    return controller.remove({ preventDefault: vi.fn() }).then(() => {
      expect(controller.dispatch).toHaveBeenCalledWith("completed", { detail: { queryId: 42 } })
    })
  })

  it("does not dispatch when confirmation is declined", () => {
    window.confirm.mockReturnValue(false)

    controller.remove({ preventDefault: vi.fn() })

    expect(controller.dispatch).not.toHaveBeenCalled()
  })

  it("reports a failed request without dispatching completion", async () => {
    window.confirm.mockReturnValue(true)
    window.fetch.mockResolvedValue({ ok: false, status: 500 })
    controller.element = document.createElement("button")
    controller.element.disabled = false
    window.quepidDom = { flash: { show: vi.fn() } }

    await controller.remove({ preventDefault: vi.fn() })

    expect(controller.dispatch).not.toHaveBeenCalled()
    expect(window.quepidDom.flash.show).toHaveBeenCalledWith("error", "Unable to delete query.")
  })
})
