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
import {
  openDetailedDocumentModal as openModal,
  sanitizeDocumentHtml
} from "utils/detailed_document_modal"

function openDetailedDocumentModal(options) {
  const result = openModal(options)
  const element = result.element.querySelector("[data-controller='detailed-document']")
  const targets = controllerTargets(element, DetailedDocumentController, "detailed-document")
  const controller = buildControllerFixture(DetailedDocumentController, {
    element,
    targets,
    values: {
      engineLabels: { solr: "Solr", es: "Elasticsearch", os: "OpenSearch", searchapi: "Search API" }
    }
  })
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
    expect(openDynamicModal.mock.calls[0][0].ariaLabelledBy).toBe("detailed-document-modal-title")
    expect(renderJsonExplorer).toHaveBeenCalledWith(
      modal.element.querySelector("[data-detailed-document-target='rawFields']"),
      JSON.stringify({ description: { nested: true }, unsafe: "<raw>" }),
      { collapsed: false }
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

    for (const unsafe of [
      "<a href='javascript:alert(1)'>JS</a>",
      "<a href='data:text/html,x'>Data</a>",
      "<a>None</a>"
    ]) {
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

  it("renders overview and cast arrays as readable strings while retaining the raw JSON explorer", () => {
    const rawFields = { overview: ["A story"], cast: ["Haley Lu Richardson", "Cole Sprouse"] }
    openDetailedDocumentModal({
      doc: { id: "527641", title: "Five Feet Apart", subs: rawFields, rawFields }
    })

    const values = [
      ...modal.element.querySelectorAll("[data-detailed-document-target='fields'] .col-md-8")
    ]
    expect(values.map((field) => field.textContent)).toEqual([
      "A story",
      "Haley Lu Richardson,Cole Sprouse"
    ])
    expect(values.some((field) => field.hasAttribute("data-detailed-doc-sub-json-index"))).toBe(
      false
    )
    expect(renderJsonExplorer).toHaveBeenCalledTimes(1)
    expect(renderJsonExplorer).toHaveBeenCalledWith(
      modal.element.querySelector("[data-detailed-document-target='rawFields']"),
      JSON.stringify(rawFields),
      { collapsed: false }
    )
  })

  it("includes the actual query in italics without interpreting its markup", () => {
    openDetailedDocumentModal({
      doc: { id: "11", title: "Document title", rawFields: {} },
      queryText: "<img src=x onerror=alert(1)>"
    })
    const heading = modal.element.querySelector("#detailed-document-modal-title")
    expect(heading.textContent).toBe(
      "Detailed Document View of doc: 11 for query <img src=x onerror=alert(1)>"
    )
    expect(heading.querySelector("em").textContent).toBe("<img src=x onerror=alert(1)>")
    expect(heading.querySelector("img")).toBeNull()
    expect(heading.querySelector("[data-detailed-document-target='queryContext']").hidden).toBe(
      false
    )
  })

  it.each([
    ["solr", "Solr"],
    ["es", "Elasticsearch"],
    ["os", "OpenSearch"],
    [null, "Search Engine"],
    ["unknown", "Search Engine"]
  ])("labels the document link for engine %s", (searchEngine, label) => {
    openDetailedDocumentModal({
      doc: { id: "doc-1", title: "Title", rawFields: {} },
      linkUrl: "https://example.test/doc-1",
      searchEngine
    })
    const button = modal.element.querySelector(".detailed-doc-view")
    expect(button.textContent).toBe(`View Document on ${label}`)
    expect(button.disabled).toBe(false)
  })

  it("uses the configured name for a mapper-based search engine", () => {
    openDetailedDocumentModal({
      doc: { id: "doc-1", rawFields: {} },
      searchEngine: "searchapi",
      mapperBasedSearchEngineName: "Vespa"
    })
    expect(modal.element.querySelector(".detailed-doc-view").textContent).toBe(
      "View Document on Vespa"
    )
  })

  it("disables View Document when there is no link", () => {
    openDetailedDocumentModal({ doc: { id: "doc-1", title: "Title", rawFields: {} } })
    expect(modal.element.querySelector(".detailed-doc-view").disabled).toBe(true)
    expect(
      modal.element.querySelector("[data-detailed-document-target='queryContext']").hidden
    ).toBe(true)
  })
})
