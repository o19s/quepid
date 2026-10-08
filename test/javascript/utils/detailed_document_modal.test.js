import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const modal = {
  element: document.createElement("div"),
  dispose: vi.fn()
}

vi.mock("utils/dynamic_modal", () => ({
  openDynamicModal: vi.fn(({ html, templateId }) => {
    modal.element.innerHTML = html || document.getElementById(templateId).innerHTML
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
import DetailedDocumentController from "controllers/detailed_document_controller"
import { buildControllerFixture } from "../support/controller_fixture"
import { loadDynamicModalTemplate, controllerTargets } from "../support/view_template"
import { openDetailedDocumentModal as openModal, sanitizeDocumentHtml } from "utils/detailed_document_modal"

function openDetailedDocumentModal(options) {
  const result = openModal(options)
  const element = result.element.querySelector("[data-controller='detailed-document']")
  const targets = controllerTargets(element, DetailedDocumentController, "detailed-document")
  const controller = buildControllerFixture(DetailedDocumentController, { element, targets })
  controller.connect()
  return result
}

describe("detailed document modal", () => {
  afterEach(() => document.getElementById("detailed-document-modal-template")?.remove())

  beforeEach(() => {
    modal.element.innerHTML = ""
    modal.dispose.mockClear()
    vi.clearAllMocks()
    const template = loadDynamicModalTemplate("detailed-document-modal-template")
    document.body.appendChild(template)
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

    expect(openDynamicModal.mock.calls[0][0].templateId).toBe("detailed-document-modal-template")
    expect(modal.element.querySelector("[data-detailed-document-target='title']").textContent).toBe("<unsafe>")
    expect(modal.element.querySelector("[data-detailed-document-target='rawFields']").textContent).toContain(
      "<raw>"
    )
    expect(renderJsonExplorer).toHaveBeenCalledWith(
      expect.any(Element),
      JSON.stringify({ nested: true }),
      { collapsed: false }
    )
  })

  it("preserves safe document structure without exposing response markup", () => {
    const html = "<section prefix='A'><p>First</p></section><section prefix='B'>Second</section>"

    const sanitized = sanitizeDocumentHtml(html)

    expect(sanitized).toContain("<section>")
    expect(sanitized).toContain("<p>First</p>")
    expect(sanitized).not.toContain("prefix=")
    expect(sanitized).not.toContain("&lt;section")
  })

  it("removes executable and embedded content, and unwraps unknown tags but keeps their text", () => {
    const sanitized = sanitizeDocumentHtml(
      "<p onclick='steal()'>Hi</p><script>steal()</script><iframe src='x'></iframe><style>p{}</style><blink>kept <b>bold</b></blink>"
    )

    expect(sanitized).toBe("<p>Hi</p>kept <b>bold</b>")
    expect(sanitizeDocumentHtml(null)).toBe("")
  })

  it("keeps only http(s) links, opening them safely in a new tab", () => {
    const anchors = (html) => {
      const container = document.createElement("div")
      container.innerHTML = sanitizeDocumentHtml(html)
      return Array.from(container.querySelectorAll("a"))
    }

    const [external] = anchors("<a href='https://example.test/doc' style='x'>Doc</a>")
    expect(external.getAttribute("href")).toBe("https://example.test/doc")
    expect(external.getAttribute("target")).toBe("_blank")
    expect(external.getAttribute("rel")).toBe("noopener noreferrer")
    expect(external.hasAttribute("style")).toBe(false)

    const [relative] = anchors("<a href='/docs/1'>Rel</a>")
    expect(relative.getAttribute("href")).toBe(new URL("/docs/1", document.baseURI).href)

    for (const unsafe of ["<a href='javascript:alert(1)'>JS</a>", "<a href='data:text/html,x'>Data</a>", "<a>None</a>"]) {
      const [link] = anchors(unsafe)
      expect(link.hasAttribute("href")).toBe(false)
      expect(link.hasAttribute("target")).toBe(false)
      expect(link.textContent).not.toBe("")
    }
  })

  it("renders scalar subfields as sanitized HTML like the legacy detailed view", () => {
    openDetailedDocumentModal({
      doc: {
        id: "doc-1",
        title: "A result",
        subs: {
          text: "<section prefix='A'>First</section><section prefix='B'>Second</section><script>alert(1)</script>"
        },
        translations: {},
        embeds: {},
        rawFields: {}
      }
    })

    const field = modal.element.querySelector("[data-detailed-document-target='fields'] .col-md-8")

    expect(field.innerHTML).toContain("<section>First</section>")
    expect(field.innerHTML).toContain("<section>Second</section>")
    expect(field.textContent).toContain("First")
    expect(field.textContent).not.toContain("<section")
    expect(field.querySelector("script")).toBeNull()
  })

  it("disables View Document when there is no link", () => {
    openDetailedDocumentModal({ doc: { id: "doc-1", title: "Title", rawFields: {} } })
    expect(modal.element.querySelector(".detailed-doc-view").disabled).toBe(true)
  })
})
