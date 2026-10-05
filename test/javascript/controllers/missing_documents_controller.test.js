import { buildControllerFixture } from "../support/controller_fixture"
import { describe, expect, it, vi } from "vitest"
import MissingDocumentsController from "controllers/missing_documents_controller"

function buildController(adapter) {
  const element = document.createElement("div")
  document.body.appendChild(element)
  const controller = buildControllerFixture(MissingDocumentsController, {
    targets: {
      queryParams: document.createElement("textarea"),
      searchButton: document.createElement("button"),
      resetButton: document.createElement("button"),
      status: document.createElement("div"),
      results: document.createElement("div"),
      next: document.createElement("button"),
      spinner: document.createElement("span"),
      engineName: document.createElement("strong")
    }
  })
  controller.element = element
  controller.adapter = adapter
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

// renderShell replaces the element's children, so point the target at the
// textarea it rendered, as Stimulus would.
function trackRenderedQueryParams(controller) {
  Object.defineProperty(controller, "queryParamsTarget", {
    get: () => controller.element.querySelector("[data-missing-documents-target='queryParams']")
  })
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
  it.each(["search", "reset", "paginate"])("restores controls after rejected %s and allows retry", async (action) => {
    const method = action === "reset" ? "resetToRated" : action
    const operation = vi.fn().mockRejectedValueOnce(new Error("Search engine unavailable")).mockResolvedValueOnce(undefined)
    const controller = buildController(adapter({ [method]: operation }))
    controller.queryParamsTarget.value = "q=custom"

    await controller[action]({ preventDefault: vi.fn() })

    expect(controller.spinnerTarget.classList.contains("d-none")).toBe(true)
    expect(controller.searchButtonTarget.disabled).toBe(false)
    expect(controller.resetButtonTarget.disabled).toBe(false)
    expect(controller.nextTarget.disabled).toBe(false)
    expect(controller.statusTarget.textContent).toContain("Please try again")
    if (action === "reset") expect(controller.queryParamsTarget.value).toBe("q=custom")

    await controller[action]({ preventDefault: vi.fn() })
    expect(operation).toHaveBeenCalledTimes(2)
    expect(controller.statusTarget.textContent).not.toContain("Please try again")
    expect(controller.statusTarget.classList.contains("alert-danger")).toBe(false)
  })

  it.each([true, false])("does not render a detached modal after a pending operation succeeds: %s", async (success) => {
    const controller = buildController(adapter())
    let finish
    let fail
    const render = vi.spyOn(controller, "render")
    const pending = controller.run(() => new Promise((resolve, reject) => { finish = resolve; fail = reject }))
    controller.disconnect()
    if (success) finish()
    else fail(new Error("Disconnected"))
    await pending
    expect(render).not.toHaveBeenCalled()
    expect(controller.statusTarget.textContent).toBe("")
  })

  it("prevents overlapping operations", async () => {
    const controller = buildController(adapter())
    let finish
    const pending = controller.run(() => new Promise(resolve => { finish = resolve }))
    const other = vi.fn()
    await controller.run(other)
    expect(other).not.toHaveBeenCalled()
    finish()
    await pending
  })
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

  it("edits Elasticsearch-like query params in a CodeMirror JSON editor", () => {
    const controller = buildController(adapter({
      settings: { searchEngine: "es" },
      initialQueryParams: () => '{"query":{"match_all":{}}}'
    }))
    trackRenderedQueryParams(controller)
    controller.renderShell()

    expect(controller.element.querySelector(".cm-editor")).not.toBeNull()
    expect(controller.queryParamsTarget.style.display).toBe("none")
    expect(controller.queryParams).toBe('{"query":{"match_all":{}}}')

    controller.setQueryParams('{"size":5}')
    expect(controller.queryParams).toBe('{"size":5}')

    controller.disconnect()
  })

  it("keeps a plain textarea for engines without JSON query params", () => {
    const controller = buildController(adapter({
      settings: { searchEngine: "solr" },
      initialQueryParams: () => "q=#$query##"
    }))
    trackRenderedQueryParams(controller)
    controller.renderShell()

    expect(controller.element.querySelector(".cm-editor")).toBeNull()
    expect(controller.queryParamsTarget.style.display).toBe("")
    expect(controller.queryParams).toBe("q=#$query##")
  })

  it("renders the unsupported-engine message, labelled from the engine catalog, without a query editor target", () => {
    const controller = buildController(adapter({
      usesQueryParamsEditor: false,
      engineName: "static"
    }))
    controller.engineLabelsValue = { static: "Static File" }
    controller.hasQueryParamsTarget = false

    expect(() => controller.renderShell()).not.toThrow()
    expect(controller.element.textContent).toContain("Static File")
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

  it("re-renders only after the rating request has been applied", async () => {
    const adapterMock = adapter({ docs: [{ id: "doc-1", title: "A document", subSnippets: () => ({}) }], numFound: 1 })
    let resolveRating
    adapterMock.rate = vi.fn(() => new Promise((resolve) => { resolveRating = resolve }))
    const controller = buildController(adapterMock)
    controller.render()
    const renderSpy = vi.spyOn(controller, "render")

    const rated = controller.rate({
      type: "rating-popover:rate",
      target: controller.resultsTarget.querySelector("search-result"),
      detail: { source: "single-result", rating: "1" }
    })
    await Promise.resolve()
    expect(renderSpy).not.toHaveBeenCalled()

    resolveRating(true)
    await rated
    expect(renderSpy).toHaveBeenCalledTimes(1)
  })
})
