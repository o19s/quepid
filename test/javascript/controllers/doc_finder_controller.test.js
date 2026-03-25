import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { Application } from "@hotwired/stimulus"
import DocFinderController from "../../../app/javascript/controllers/doc_finder_controller"
import { waitForController } from "../support/stimulus_helpers"

// Mock search executor
vi.mock("modules/search_executor", () => ({
  executeSearch: vi.fn(),
}))
import { executeSearch } from "modules/search_executor"

// Mock scorer
vi.mock("modules/scorer", () => ({
  ratingColor: vi.fn(() => "#4caf50"),
}))

// Mock bootstrap modal
const mockModal = { show: vi.fn(), hide: vi.fn() }
window.bootstrap = { Modal: { getOrCreateInstance: () => mockModal } }

describe("DocFinderController", () => {
  let application
  const originalFetch = global.fetch

  beforeEach(async () => {
    document.body.dataset.caseId = "5"
    document.body.dataset.tryNumber = "1"
    document.head.innerHTML = '<meta name="csrf-token" content="test-csrf">'

    document.body.innerHTML = `
      <div id="doc-finder-modal" class="modal" data-controller="doc-finder">
        <input data-doc-finder-target="searchInput" />
        <div data-doc-finder-target="resultsContainer"></div>
      </div>
    `

    application = Application.start()
    application.register("doc-finder", DocFinderController)
    await waitForController(application, '[data-controller="doc-finder"]', "doc-finder")
  })

  afterEach(() => {
    application.stop()
    global.fetch = originalFetch
    vi.clearAllMocks()
    // Clean up injected styles
    const style = document.getElementById("rating-color-styles")
    if (style) style.remove()
  })

  function getController() {
    return application.getControllerForElementAndIdentifier(
      document.querySelector('[data-controller="doc-finder"]'),
      "doc-finder",
    )
  }

  function makeContext(overrides = {}) {
    return {
      queryId: 1,
      ratingsStore: {
        ratings: {},
        getRating: vi.fn(() => null),
        rate: vi.fn(),
        unrate: vi.fn(),
      },
      scorerScale: [0, 1, 2, 3],
      colorMap: {},
      onRatingChanged: vi.fn(),
      ...overrides,
    }
  }

  it("connects and registers event listener", () => {
    const ctrl = getController()
    expect(ctrl._context).toBeNull()
    expect(ctrl.modalInstance).toBeNull()
  })

  it("open stores context and shows modal", () => {
    const ctrl = getController()
    const ctx = makeContext()
    ctrl.open(ctx)

    expect(ctrl._context).toBe(ctx)
    expect(ctrl.searchInputTarget.value).toBe("")
    expect(ctrl.resultsContainerTarget.innerHTML).toBe("")
    expect(mockModal.show).toHaveBeenCalled()
  })

  it("search does nothing without context", async () => {
    const ctrl = getController()
    await ctrl.search()
    expect(executeSearch).not.toHaveBeenCalled()
  })

  it("search does nothing with empty input", async () => {
    const ctrl = getController()
    ctrl.open(makeContext())
    ctrl.searchInputTarget.value = "   "
    await ctrl.search()
    expect(executeSearch).not.toHaveBeenCalled()
  })

  it("search renders results from executeSearch", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          search_engine: "solr",
          field_spec: "id:id, title:title",
        }),
    })

    executeSearch.mockResolvedValue({
      docs: [
        { id: "doc1", title: "Result One" },
        { id: "doc2", title: "Result Two" },
      ],
    })

    const ctrl = getController()
    ctrl.open(makeContext())
    ctrl.searchInputTarget.value = "test query"
    await ctrl.search()

    expect(ctrl.resultsContainerTarget.querySelectorAll(".doc-row").length).toBe(2)
    expect(ctrl.resultsContainerTarget.innerHTML).toContain("Result One")
    expect(ctrl.resultsContainerTarget.innerHTML).toContain("Result Two")
  })

  it("search shows error when executeSearch returns error", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ search_engine: "solr" }),
    })
    executeSearch.mockResolvedValue({ error: "Connection refused" })

    const ctrl = getController()
    ctrl.open(makeContext())
    ctrl.searchInputTarget.value = "test"
    await ctrl.search()

    expect(ctrl.resultsContainerTarget.innerHTML).toContain("Connection refused")
    expect(ctrl.resultsContainerTarget.querySelector(".alert-warning")).not.toBeNull()
  })

  it("renders rating buttons for each scale value", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ search_engine: "solr" }),
    })
    executeSearch.mockResolvedValue({ docs: [{ id: "doc1", title: "A" }] })

    const ctrl = getController()
    ctrl.open(makeContext({ scorerScale: [0, 1, 2] }))
    ctrl.searchInputTarget.value = "test"
    await ctrl.search()

    const buttons = ctrl.resultsContainerTarget.querySelectorAll(".rating-btn")
    expect(buttons.length).toBe(3) // 3 scale values, no clear button (rating is null)
  })

  it("renders clear button when doc has a rating", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ search_engine: "solr" }),
    })
    executeSearch.mockResolvedValue({ docs: [{ id: "doc1", title: "A" }] })

    const ctx = makeContext()
    ctx.ratingsStore.getRating = vi.fn(() => 2)

    const ctrl = getController()
    ctrl.open(ctx)
    ctrl.searchInputTarget.value = "test"
    await ctrl.search()

    const clearBtn = ctrl.resultsContainerTarget.querySelector(".rating-btn-clear")
    expect(clearBtn).not.toBeNull()
  })

  it("rateDoc calls ratingsStore.rate and re-renders", async () => {
    const ctx = makeContext()
    const ctrl = getController()
    ctrl.open(ctx)
    ctrl._finderDocs = [{ id: "doc1", title: "A" }]

    await ctrl.rateDoc({ currentTarget: { dataset: { finderDocIdx: "0", ratingValue: "3" } } })

    expect(ctx.ratingsStore.rate).toHaveBeenCalledWith("doc1", 3)
    expect(ctx.onRatingChanged).toHaveBeenCalled()
  })

  it("rateDoc unrates when clicking same rating", async () => {
    const ctx = makeContext()
    ctx.ratingsStore.getRating = vi.fn(() => 3)

    const ctrl = getController()
    ctrl.open(ctx)
    ctrl._finderDocs = [{ id: "doc1", title: "A" }]

    await ctrl.rateDoc({ currentTarget: { dataset: { finderDocIdx: "0", ratingValue: "3" } } })

    expect(ctx.ratingsStore.unrate).toHaveBeenCalledWith("doc1")
  })

  it("unrateDoc calls ratingsStore.unrate", async () => {
    const ctx = makeContext()
    const ctrl = getController()
    ctrl.open(ctx)
    ctrl._finderDocs = [{ id: "doc1", title: "A" }]

    await ctrl.unrateDoc({ currentTarget: { dataset: { finderDocIdx: "0" } } })

    expect(ctx.ratingsStore.unrate).toHaveBeenCalledWith("doc1")
    expect(ctx.onRatingChanged).toHaveBeenCalled()
  })

  it("_getIdField returns id field from field spec", () => {
    const ctrl = getController()
    expect(ctrl._getIdField({ field_spec: "id:myid, title:name" })).toBe("myid")
  })

  it("_getIdField returns default for Solr when no id in spec", () => {
    const ctrl = getController()
    expect(ctrl._getIdField({ field_spec: "title:name", search_engine: "solr" })).toBe("id")
  })

  it("_getIdField returns _id for ES when no id in spec", () => {
    const ctrl = getController()
    expect(ctrl._getIdField({ field_spec: "title:name", search_engine: "es" })).toBe("_id")
  })

  it("_fetchTryConfig caches result per try number", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ search_engine: "solr" }),
    })

    const ctrl = getController()
    await ctrl._fetchTryConfig()
    await ctrl._fetchTryConfig()

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    fetchSpy.mockRestore()
  })

  it("_fetchTryConfig invalidates cache when try number changes", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ search_engine: "solr" }),
    })

    const ctrl = getController()
    await ctrl._fetchTryConfig()

    document.body.dataset.tryNumber = "2"
    await ctrl._fetchTryConfig()

    expect(fetchSpy).toHaveBeenCalledTimes(2)
    fetchSpy.mockRestore()
  })

  it("responds to show-doc-finder custom event", () => {
    const ctx = makeContext()
    document.dispatchEvent(new CustomEvent("show-doc-finder", { detail: ctx }))

    const ctrl = getController()
    expect(ctrl._context).toBe(ctx)
  })

  it("showRatedDocs shows message when no ratings", async () => {
    const ctx = makeContext()
    ctx.ratingsStore.ratings = {}

    const ctrl = getController()
    ctrl.open(ctx)
    await ctrl.showRatedDocs()

    expect(ctrl.resultsContainerTarget.innerHTML).toContain("No rated documents")
  })

  it("injects rating color styles only once", () => {
    const ctrl = getController()
    ctrl.open(makeContext({ scorerScale: [0, 1, 2] }))
    ctrl._ensureRatingColorStyles()
    ctrl._ensureRatingColorStyles()

    const styles = document.querySelectorAll("#rating-color-styles")
    expect(styles.length).toBe(1)
  })
})
