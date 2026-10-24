import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("utils/clipboard", () => ({ copyText: vi.fn() }))

import { copyText } from "utils/clipboard"
import ClipboardController from "controllers/clipboard_controller"

function buildController() {
  const controller = Object.create(ClipboardController.prototype)
  controller.textValue = "analytics/tries_visualization/abc"
  return controller
}

describe("ClipboardController", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("copies its text value", () => {
    copyText.mockResolvedValue(undefined)

    buildController().copy()

    expect(copyText).toHaveBeenCalledWith("analytics/tries_visualization/abc")
  })

  it("logs a rejected copy instead of leaving it unhandled", async () => {
    const error = new Error("denied")
    copyText.mockRejectedValue(error)
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    buildController().copy()

    await vi.waitFor(() => expect(consoleError).toHaveBeenCalledWith(error))
  })
})
