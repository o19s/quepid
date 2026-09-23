import { beforeEach, describe, expect, it, vi } from "vitest"
import { openDetailedDocumentModal } from "utils/detailed_document_modal"

const modal = {
  element: document.createElement("div"),
  dispose: vi.fn()
}

vi.mock("utils/dynamic_modal", () => ({
  openDynamicModal: vi.fn(({ html }) => {
    modal.element.innerHTML = html
    return modal
  })
}))

vi.mock("utils/json_explorer", () => ({
  escapeHtml: (value) =>
    String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"),
  renderJsonExplorer: vi.fn()
}))

import { openDynamicModal } from "utils/dynamic_modal"
import { renderJsonExplorer } from "utils/json_explorer"

describe("detailed document modal", () => {
  beforeEach(() => {
    modal.element.innerHTML = ""
    modal.dispose.mockClear()
    vi.clearAllMocks()
  })

  it("renders escaped fields, raw JSON, and nested field explorers", () => {
    openDetailedDocumentModal({
      doc: {
        id: "doc-1",
        title: "<unsafe>",
        subs: { description: { nested: true } },
        translations: { title: "Translated" },
        embeds: { video: "https://example.test/video.mp4" },
        rawFields: { description: { nested: true }, unsafe: "<raw>" },
        hasThumb: true,
        thumb: "thumb.jpg",
        hasImage: false
      },
      linkUrl: "https://example.test/doc-1"
    })

    const html = openDynamicModal.mock.calls[0][0].html
    expect(html).toContain("&lt;unsafe&gt;")
    expect(html).toContain("&lt;raw&gt;")
    expect(html).toContain("View Document")
    expect(html).not.toContain("<unsafe>")
    expect(renderJsonExplorer).toHaveBeenCalledWith(
      expect.any(Element),
      JSON.stringify({ nested: true }),
      { collapsed: false }
    )
  })

  it("toggles all-fields visibility and disposes from Close", () => {
    openDetailedDocumentModal({ doc: { id: "doc-1", title: "Title", rawFields: {} } })
    const allFields = modal.element.querySelector(".detailed-doc-all-fields")
    const toggle = modal.element.querySelector(".detailed-doc-toggle-fields")
    const close = modal.element.querySelector(".detailed-doc-close")

    expect(allFields.style.display).toBe("none")
    toggle.click()
    expect(allFields.style.display).toBe("")
    expect(toggle.textContent).toBe("Hide All Fields")
    toggle.click()
    expect(allFields.style.display).toBe("none")
    expect(toggle.textContent).toBe("View All Fields")
    close.click()
    expect(modal.dispose).toHaveBeenCalledTimes(1)
  })

  it("disables View Document when there is no link", () => {
    openDetailedDocumentModal({ doc: { id: "doc-1", title: "Title", rawFields: {} } })
    expect(modal.element.querySelector(".detailed-doc-view").disabled).toBe(true)
  })
})
