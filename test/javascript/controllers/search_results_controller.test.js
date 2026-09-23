import { beforeEach, describe, expect, it } from "vitest"
import SearchResultsController from "controllers/search_results_controller"

function controllerFor({ showOnlyRated = false, results = true, expanded = true } = {}) {
  const element = document.createElement("div")
  element.innerHTML = `
    <div data-search-results-target="content">
      <div data-search-results-target="results"></div>
    </div>
  `
  const controller = Object.create(SearchResultsController.prototype)
  controller.element = element
  controller.contentTarget = element.querySelector('[data-search-results-target="content"]')
  controller.resultsTarget = element.querySelector('[data-search-results-target="results"]')
  controller.hasContentTarget = true
  controller.hasResultsTarget = true
  const snapshot = {
    queryId: 1,
    docs: [{ id: "all" }],
    ratedDocs: [{ id: "rated" }],
    expanded,
    resultsView: results ? 2 : 3,
    showOnlyRated
  }
  controller.store = { query: () => snapshot }
  controller.element.dataset.queryId = "1"
  return { controller, snapshot }
}

describe("SearchResultsController", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  it("selects current or rated documents without changing the query service", () => {
    const current = controllerFor()
    expect(current.controller.visibleDocuments(current.controller.store.query())).toEqual([{ id: "all" }])

    const rated = controllerFor({ showOnlyRated: true })
    expect(rated.controller.visibleDocuments(rated.controller.store.query())).toEqual([{ id: "rated" }])
  })

  it("does not render documents while the diff view is selected", () => {
    const { controller } = controllerFor({ results: false })
    controller.render()

    expect(controller.contentTarget.classList.contains("d-none")).toBe(false)
    expect(controller.resultsTarget.childElementCount).toBe(0)
  })

  it("hides the expanded read path when the query is collapsed", () => {
    const { controller } = controllerFor({ expanded: false })
    controller.render()

    expect(controller.contentTarget.classList.contains("d-none")).toBe(true)
  })

  it("renders from store state without an Angular scope", () => {
    const { controller } = controllerFor()
    expect(controller.angularScope).toBeUndefined()
    controller.render()
    expect(controller.resultsTarget.childElementCount).toBe(1)
  })
})
