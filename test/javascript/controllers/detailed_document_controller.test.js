import { describe, expect, it, vi } from "vitest"
import DetailedDocumentController from "controllers/detailed_document_controller"
import { buildControllerFixture } from "../support/controller_fixture"

function owner(linkUrl = "") {
  const allFields = document.createElement("div")
  allFields.style.display = "none"
  const toggle = document.createElement("a")
  toggle.textContent = "View All Fields"
  return buildControllerFixture(DetailedDocumentController, {
    targets: { allFields, toggle }, values: { linkUrl }
  })
}

describe("DetailedDocumentController", () => {
  it("toggles all fields and restores the original label", () => {
    const controller = owner()
    const event = { preventDefault: vi.fn() }
    controller.toggleFields(event)
    expect(controller.allFieldsTarget.style.display).toBe("")
    expect(controller.toggleTarget.textContent).toBe("Hide All Fields")
    controller.toggleFields(event)
    expect(controller.allFieldsTarget.style.display).toBe("none")
    expect(controller.toggleTarget.textContent).toBe("View All Fields")
    expect(event.preventDefault).toHaveBeenCalledTimes(2)
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
