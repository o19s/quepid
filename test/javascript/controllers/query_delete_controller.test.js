import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import QueryDeleteController from "controllers/query_delete_controller"

describe("query-delete controller", () => {
  let controller

  beforeEach(() => {
    controller = new QueryDeleteController(document.createElement("button"))
    Object.defineProperty(controller, "queryIdValue", { configurable: true, value: 42 })
    controller.dispatch = vi.fn()
    window.confirm = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("dispatches the query id after confirmation", () => {
    window.confirm.mockReturnValue(true)

    controller.remove({ preventDefault: vi.fn() })

    expect(controller.dispatch).toHaveBeenCalledWith("submit", { detail: { queryId: 42 } })
  })

  it("does not dispatch when confirmation is declined", () => {
    window.confirm.mockReturnValue(false)

    controller.remove({ preventDefault: vi.fn() })

    expect(controller.dispatch).not.toHaveBeenCalled()
  })
})
