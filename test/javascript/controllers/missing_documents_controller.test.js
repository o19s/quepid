import { describe, expect, it, vi } from "vitest"
import MissingDocumentsController from "controllers/missing_documents_controller"

function buildController(adapter) {
  const element = document.createElement("div")
  document.body.appendChild(element)
  const controller = Object.create(MissingDocumentsController.prototype)
  controller.element = element
  controller.adapter = adapter
  controller.queryParamsTarget = document.createElement("textarea")
  controller.hasQueryParamsTarget = true
  controller.hasQueryParamsEditorTarget = false
  controller.searchButtonTarget = document.createElement("button")
  controller.resetButtonTarget = document.createElement("button")
  controller.statusTarget = document.createElement("div")
  controller.resultsTarget = document.createElement("div")
  controller.nextTarget = document.createElement("button")
  controller.spinnerTarget = document.createElement("span")
  controller.engineNameTarget = document.createElement("strong")
  element.append(
    controller.queryParamsTarget,
    controller.searchButtonTarget,
    controller.resetButtonTarget,
    controller.statusTarget,
    controller.resultsTarget,
    controller.nextTarget,
    controller.spinnerTarget,
    controller.engineNameTarget
  )
  return controller
}

function adapter(overrides = {}) {
  return {
    usesQueryParamsEditor: true,
    queryText: "original query",
    query: { maxDocScore: () => 1 },
    ratingScale: { 1: { color: "green" } },
    docs: [],
    numFound: 0,
    defaultList: false,
    parseError: false,
    ratedDocsLookupUnsupported: false,
    initialQueryParams: () => "",
    ...overrides
  }
}

describe("MissingDocumentsController", () => {
  it("renders the empty-search state", () => {
    const controller = buildController(adapter({ lastQuery: "title:missing" }))
    controller.render()

    expect(controller.statusTarget.textContent).toContain("title:missing")
    expect(controller.resultsTarget.children).toHaveLength(0)
  })

  it("renders dynamic query and engine text without interpreting markup", () => {
    const controller = buildController(adapter({
      queryText: "<img src=x onerror=alert(1)>",
      lastQuery: "<svg onload=alert(2)>",
      numFound: 0
    }))
    controller.render()

    expect(controller.statusTarget.querySelector("img, svg")).toBeNull()
    expect(controller.statusTarget.textContent).toContain("<svg onload=alert(2)>")

    controller.adapter = adapter({
      usesQueryParamsEditor: false,
      engineName: "<img src=x onerror=alert(3)>"
    })
    controller.renderShell()

    expect(controller.element.querySelector(".alert img")).toBeNull()
    expect(controller.element.querySelector("[data-missing-documents-target='engineName']").textContent)
      .toBe("<img src=x onerror=alert(3)>")
  })

  it("does not report no results for an empty rated-document list", () => {
    const controller = buildController(adapter({ defaultList: true, numFound: 0 }))
    controller.render()

    expect(controller.statusTarget.textContent).toBe("")
  })

  it("disables reset while already showing rated documents", () => {
    const controller = buildController(adapter({ defaultList: true }))
    controller.render()
    expect(controller.resetButtonTarget.disabled).toBe(true)

    controller.adapter.defaultList = false
    controller.render()
    expect(controller.resetButtonTarget.disabled).toBe(false)
  })

  it("restores the original query parameters after reset", async () => {
    const adapterMock = adapter({
      initialQueryParams: () => "q=original",
      resetToRated: vi.fn().mockResolvedValue(undefined)
    })
    const controller = buildController(adapterMock)
    controller.queryParamsTarget.value = "q=custom"

    await controller.reset()

    expect(controller.queryParamsTarget.value).toBe("q=original")
  })

  it("renders the unsupported-engine message without a query editor target", () => {
    const controller = buildController(adapter({
      usesQueryParamsEditor: false,
      engineName: "Static"
    }))
    controller.hasQueryParamsTarget = false

    expect(() => controller.renderShell()).not.toThrow()
    expect(controller.element.textContent).toContain("Static")
  })

  it("renders documents with the shared search-result controller", () => {
    const controller = buildController(adapter({
      docs: [{ id: "doc-1", title: "A document", subSnippets: () => ({}) }],
      numFound: 1,
      lastQuery: "title:document"
    }))
    controller.render()

    expect(controller.resultsTarget.querySelector("search-result").dataset.docId).toBe("doc-1")
    expect(controller.resultsTarget.textContent).toContain("Changing ratings will affect the query score.")
  })

  it("routes single-result and score-all rating events through the adapter", () => {
    const adapterMock = adapter({ docs: [{ id: "doc-1", title: "A document", subSnippets: () => ({}) }], numFound: 1 })
    adapterMock.rate = vi.fn()
    adapterMock.rateAll = vi.fn()
    const controller = buildController(adapterMock)
    controller.render()

    const result = controller.resultsTarget.querySelector("search-result")
    controller.rate({
      type: "rating-popover:rate",
      target: result,
      detail: { source: "single-result", rating: "2" }
    })
    controller.rate({ type: "rating-popover:reset", target: controller.resultsTarget, detail: {} })

    expect(adapterMock.rate).toHaveBeenCalledWith("doc-1", 2)
    expect(adapterMock.rateAll).toHaveBeenCalledWith(null)
  })
})
