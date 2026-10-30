import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { application } from "controllers/application"
import { confirmDialog } from "utils/confirm_dialog"

vi.mock("controllers/application", () => ({
  application: { getControllerForElementAndIdentifier: vi.fn() }
}))

describe("confirmDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true)
    )
  })
  afterEach(() => {
    document.body.innerHTML = ""
    vi.unstubAllGlobals()
  })

  it("asks the shared modal's confirm-dialog controller with the style", async () => {
    document.body.innerHTML = '<div id="confirmModal"></div>'
    const dialog = { ask: vi.fn().mockResolvedValue(false) }
    application.getControllerForElementAndIdentifier.mockReturnValue(dialog)

    await expect(confirmDialog("Archive?", "primary")).resolves.toBe(false)

    expect(application.getControllerForElementAndIdentifier).toHaveBeenCalledWith(
      document.getElementById("confirmModal"),
      "confirm-dialog"
    )
    expect(dialog.ask).toHaveBeenCalledWith("Archive?", "primary")
    expect(window.confirm).not.toHaveBeenCalled()
  })

  it("falls back to native confirm when the modal is missing", async () => {
    await expect(confirmDialog("Delete?")).resolves.toBe(true)
    expect(window.confirm).toHaveBeenCalledWith("Delete?")
  })

  it("falls back to native confirm before the controller connects", async () => {
    document.body.innerHTML = '<div id="confirmModal"></div>'
    application.getControllerForElementAndIdentifier.mockReturnValue(null)

    await expect(confirmDialog("Delete?")).resolves.toBe(true)
    expect(window.confirm).toHaveBeenCalledWith("Delete?")
  })
})
