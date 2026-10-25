import { describe, expect, it, vi } from "vitest"
import DetailedDocumentController from "controllers/detailed_document_controller"
import { buildControllerFixture } from "../support/controller_fixture"

function owner(linkUrl = "") {
  return buildControllerFixture(DetailedDocumentController, {
    values: { linkUrl }
  })
}

describe("DetailedDocumentController", () => {
  it("disposes Bootstrap tab instances when the modal disconnects", () => {
    const tabs = [document.createElement("button"), document.createElement("button")]
    const dispose = vi.fn()
    const getInstance = vi.fn(() => ({ dispose }))
    vi.stubGlobal("bootstrap", { Tab: { getInstance } })
    try {
      const controller = buildControllerFixture(DetailedDocumentController, { targets: { tab: tabs } })
      controller.disconnect()
      expect(getInstance.mock.calls.map(([element]) => element)).toEqual(tabs)
      expect(dispose).toHaveBeenCalledTimes(2)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it("opens the supplied link safely and does nothing without a link", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null)
    try {
      owner().view()
      expect(open).not.toHaveBeenCalled()
      owner("https://example.test/doc").view()
      expect(open).toHaveBeenCalledWith("https://example.test/doc", "_blank", "noopener,noreferrer")
    } finally {
      open.mockRestore()
    }
  })
})
