import { beforeEach, describe, expect, it, vi } from "vitest"
import { copyText } from "utils/clipboard"
import SearchResultsController from "controllers/search_results_controller"

vi.mock("utils/clipboard", () => ({
  copyText: vi.fn(() => Promise.resolve())
}))

function controllerFor({ showOnlyRated = false, results = true, expanded = true, errorText = "", numFound = 1, ratedDocsFound = 1, depthOfRating = null } = {}) {
  const element = document.createElement("div")
  element.innerHTML = `
    <div data-search-results-target="content">
      <div data-search-results-target="scoreAll"></div>
      <div data-search-results-target="error"></div>
      <div data-search-results-target="footer">
        <button data-search-results-target="nextPage"></button>
        <div data-search-results-target="depthNote"><span data-search-results-target="depthValue"></span></div>
        <div data-search-results-target="ratedNote"></div>
      </div>
      <div data-search-results-target="results"></div>
    </div>
  `
  const controller = Object.create(SearchResultsController.prototype)
  controller.element = element
  controller.contentTarget = element.querySelector('[data-search-results-target="content"]')
  controller.resultsTarget = element.querySelector('[data-search-results-target="results"]')
  controller.scoreAllTarget = element.querySelector('[data-search-results-target="scoreAll"]')
  controller.errorTarget = element.querySelector('[data-search-results-target="error"]')
  controller.footerTarget = element.querySelector('[data-search-results-target="footer"]')
  controller.nextPageTarget = element.querySelector('[data-search-results-target="nextPage"]')
  controller.depthNoteTarget = element.querySelector('[data-search-results-target="depthNote"]')
  controller.depthValueTarget = element.querySelector('[data-search-results-target="depthValue"]')
  controller.ratedNoteTarget = element.querySelector('[data-search-results-target="ratedNote"]')
  controller.hasContentTarget = true
  controller.hasResultsTarget = true
  controller.hasScoreAllTarget = true
  controller.hasErrorTarget = true
  controller.hasFooterTarget = true
  controller.hasNextPageTarget = true
  controller.hasDepthNoteTarget = true
  controller.hasDepthValueTarget = true
  controller.hasRatedNoteTarget = true
  const snapshot = {
    queryId: 1,
    queryText: "meetings",
    docs: [{ id: "all" }],
    ratedDocs: [{ id: "rated" }],
    numFound,
    ratedDocsFound,
    errorText,
    depthOfRating,
    paginationSupported: true,
    expanded,
    resultsView: results ? 2 : 3,
    showOnlyRated,
    ratingScale: { 2: { color: "rgb(1, 2, 3)" } },
    queryRating: 2
  }
  controller.store = {
    query: () => snapshot,
    updateQueryState: (_queryId, state) => Object.assign(snapshot, state)
  }
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

  it("renders Score All from the document store", () => {
    const { controller } = controllerFor()
    controller.render()

    expect(controller.scoreAllTarget.textContent).toContain("Score All")
    expect(controller.scoreAllTarget.querySelector(".btn").textContent).toContain("2")
    expect(controller.scoreAllTarget.querySelector('[data-controller="rating-popover"]')
      .getAttribute("data-rating-popover-scale-value"))
      .toBe(JSON.stringify({ 2: { color: "rgb(1, 2, 3)" } }))
  })

  it("renders errors, pagination, and rated/depth notices from store state", () => {
    const { controller } = controllerFor({ numFound: 3, depthOfRating: 2, errorText: "Search failed" })
    controller.render()

    expect(controller.errorTarget.textContent).toContain("Search failed")
    expect(controller.errorTarget.classList.contains("d-none")).toBe(false)
    expect(controller.nextPageTarget.classList.contains("d-none")).toBe(false)
    expect(controller.depthNoteTarget.classList.contains("d-none")).toBe(false)

    const rated = controllerFor({ showOnlyRated: true, ratedDocsFound: 3 })
    rated.controller.render()
    expect(rated.controller.ratedNoteTarget.classList.contains("d-none")).toBe(false)
  })

  it("preserves safe formatting and links in search errors", () => {
    const { controller } = controllerFor({ errorText: 'Failed: <strong>Solr</strong> <a href="https://example.com">troubleshooting</a> <script>alert(1)</script>' })
    controller.render()

    expect(controller.errorTarget.querySelector("strong").textContent).toBe("Solr")
    expect(controller.errorTarget.querySelector("a").getAttribute("href")).toBe("https://example.com/")
    expect(controller.errorTarget.querySelector("script")).toBeNull()
  })

  it("routes pagination and collapse through explicit query-state adapters", () => {
    const { controller } = controllerFor({ numFound: 2 })
    controller.render()
    const paginateQuery = vi.fn()
    const toggleQuery = vi.fn()
    window.quepidSearch = { queryState: { paginateQuery, toggleQuery } }

    controller.paginate({ preventDefault: vi.fn() })
    controller.collapse({ preventDefault: vi.fn() })

    expect(paginateQuery).toHaveBeenCalledWith("1", false)
    expect(toggleQuery).toHaveBeenCalledWith("1")
  })

  it("routes Score All ratings through the explicit query-state adapter", () => {
    const { controller } = controllerFor()
    controller.render()
    const rateAll = vi.fn()
    window.quepidSearch = { queryState: { rateAll } }
    const event = {
      type: "rating-popover:rate",
      detail: { rating: "3" },
      target: controller.scoreAllTarget.querySelector(".single-rating"),
      stopPropagation: vi.fn()
    }

    controller.handleRating(event)

    expect(rateAll).toHaveBeenCalledWith("1", 3)
  })

  it("toggles notes in the document store", () => {
    const { controller, snapshot } = controllerFor()
    controller.toggleNotes({ preventDefault: vi.fn() })

    expect(snapshot.notes).toBe(true)
  })

  it("copies the query text from the document store", () => {
    const { controller } = controllerFor()

    controller.copyQuery({ preventDefault: vi.fn() })

    expect(copyText).toHaveBeenCalledWith("meetings")
  })

  it("routes query expansion through the explicit query-state adapter", () => {
    const { controller } = controllerFor()
    const toggleQuery = vi.fn()
    window.quepidSearch = { queryState: { toggleQuery } }
    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() }

    controller.handleQueryToggle(event)

    expect(toggleQuery).toHaveBeenCalledWith("1")
    expect(event.preventDefault).toHaveBeenCalled()
    expect(event.stopPropagation).toHaveBeenCalled()
  })

})
