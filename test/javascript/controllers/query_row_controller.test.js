import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { waitFor } from "@testing-library/dom"
import { Application } from "@hotwired/stimulus"
import QueryRowController from "../../../app/javascript/controllers/query_row_controller"
import { waitForController } from "../support/stimulus_helpers"

// Mock splainer-search — createNormalDoc returns a flat doc,
// createFieldSpec returns a stub, createSearcher returns a mock searcher
const mockSearcher = {
  search: vi.fn().mockResolvedValue(undefined),
  pager: vi.fn(() => null),
  docs: [],
  numFound: 0,
  inError: false,
  linkUrl: null,
  callUrl: null,
  queryDsl: null,
  queryDetails: null,
  parsedQueryDetails: null,
}
vi.mock("modules/searcher_adapter", () => ({
  createQuepidSearcher: vi.fn(() => mockSearcher),
}))

vi.mock("splainer-search", () => ({
  createNormalDoc: vi.fn((fieldSpec, doc) => ({
    id: doc.id || doc._id || "unknown",
    title: doc.title || (doc._source && doc._source.title) || doc.id || "untitled",
    subs: {},
    embeds: {},
    translations: {},
    thumb: undefined,
    doc: { origin: () => doc._source || doc },
    explain: () => null,
    score: () => null,
    hotMatchesOutOf: () => [],
    subSnippets: () => ({}),
    _url: () => null,
  })),
  createFieldSpec: vi.fn(() => ({
    id: "id",
    title: "title",
    fields: ["id", "title"],
    subs: [],
    fieldList: () => ["id", "title"],
  })),
}))

/**
 * UI behavior for a single query row (expand/collapse, safe HTML rendering).
 * Scorer execution is covered in scorer_executor.test.js; ratings persistence
 * remains integration-heavy and is covered at the API layer in Rails tests.
 */
describe("QueryRowController", () => {
  let application

  beforeEach(async () => {
    document.head.innerHTML = '<meta name="csrf-token" content="test-csrf">'
    document.body.setAttribute("data-case-id", "1")
    document.body.setAttribute("data-try-number", "1")
    document.body.setAttribute("data-scorer-scale", "[0,1,2,3]")
    document.body.innerHTML = `
      <li data-controller="query-row"
          data-query-row-query-id-value="99"
          data-query-row-query-text-value="test query"
          data-query-row-ratings-value="{}">
        <div data-query-row-target="expandedContent" class="d-none"></div>
        <span data-query-row-target="chevron" class="bi bi-chevron-down"></span>
        <small data-query-row-target="totalResults"></small>
        <div data-query-row-target="scoreDisplay">--</div>
        <div data-query-row-target="resultsContainer"><p>placeholder</p></div>
      </li>
    `

    // Reset mock searcher state
    mockSearcher.search.mockResolvedValue(undefined)
    mockSearcher.pager.mockReturnValue(null)
    mockSearcher.docs = []
    mockSearcher.numFound = 0
    mockSearcher.inError = false
    mockSearcher.linkUrl = null
    mockSearcher.callUrl = null
    mockSearcher.queryDsl = null
    mockSearcher.queryDetails = null
    mockSearcher.parsedQueryDetails = null

    application = Application.start()
    application.register("query-row", QueryRowController)
    await waitForController(application, '[data-controller="query-row"]', "query-row")
  })

  afterEach(() => {
    if (application) application.stop()
  })

  it("expand shows content and flips chevron when search already loaded (no search fetch)", () => {
    const el = document.querySelector("[data-controller=query-row]")
    const ctrl = application.getControllerForElementAndIdentifier(el, "query-row")
    ctrl.searchLoaded = true

    ctrl.expand()

    expect(ctrl.expanded).toBe(true)
    expect(ctrl.expandedContentTarget.classList.contains("d-none")).toBe(false)
    expect(ctrl.chevronTarget.classList.contains("bi-chevron-up")).toBe(true)
  })

  it("collapse hides content and flips chevron", () => {
    const el = document.querySelector("[data-controller=query-row]")
    const ctrl = application.getControllerForElementAndIdentifier(el, "query-row")
    ctrl.expanded = true
    ctrl.expandedContentTarget.classList.remove("d-none")
    ctrl.chevronTarget.classList.remove("bi-chevron-down")
    ctrl.chevronTarget.classList.add("bi-chevron-up")

    ctrl.collapse()

    expect(ctrl.expanded).toBe(false)
    expect(ctrl.expandedContentTarget.classList.contains("d-none")).toBe(true)
    expect(ctrl.chevronTarget.classList.contains("bi-chevron-down")).toBe(true)
  })

  it("toggle switches between expanded and collapsed", () => {
    const el = document.querySelector("[data-controller=query-row]")
    const ctrl = application.getControllerForElementAndIdentifier(el, "query-row")
    ctrl.searchLoaded = true

    ctrl.toggle()
    expect(ctrl.expanded).toBe(true)

    ctrl.toggle()
    expect(ctrl.expanded).toBe(false)
  })

  it("renderResults escapes HTML in titles (XSS-safe like Angular bindings)", () => {
    const el = document.querySelector("[data-controller=query-row]")
    const ctrl = application.getControllerForElementAndIdentifier(el, "query-row")

    ctrl.renderResults({
      error: null,
      docs: [
        {
          id: "d1",
          title: "<img src=x onerror=alert(1)>",
          subs: { note: "<b>hi</b>" },
          hotMatchesOutOf: () => [],
        },
      ],
      numFound: 1,
      linkUrl: null,
    })

    const html = ctrl.resultsContainerTarget.innerHTML
    expect(html).not.toContain("<img src=x onerror=alert(1)>")
    expect(html).toContain("&lt;img")
    expect(html).toContain("&lt;b&gt;hi&lt;/b&gt;")
  })

  it("disconnect aborts the active AbortController (runSearch lifecycle)", () => {
    const el = document.querySelector("[data-controller=query-row]")
    const ctrl = application.getControllerForElementAndIdentifier(el, "query-row")

    const abortSpy = vi.spyOn(AbortController.prototype, "abort")
    ctrl.abortController = new AbortController()

    ctrl.disconnect()

    expect(abortSpy).toHaveBeenCalled()
    expect(ctrl.abortController).toBeNull()

    abortSpy.mockRestore()
  })

  // --- Query notes tests ---

  it("toggleNotes shows and hides the notes panel", async () => {
    // Add notes panel to DOM
    const el = document.querySelector("[data-controller=query-row]")
    const panel = document.createElement("div")
    panel.className = "d-none"
    panel.setAttribute("data-query-row-target", "notesPanel")
    el.appendChild(panel)

    const ctrl = application.getControllerForElementAndIdentifier(el, "query-row")
    ctrl.toggleNotes()
    expect(panel.classList.contains("d-none")).toBe(false)

    ctrl.toggleNotes()
    expect(panel.classList.contains("d-none")).toBe(true)
  })

  it("saveNotes sends PUT to notes endpoint", async () => {
    const el = document.querySelector("[data-controller=query-row]")

    // Add notes targets
    const panel = document.createElement("div")
    panel.setAttribute("data-query-row-target", "notesPanel")
    const notesInput = document.createElement("textarea")
    notesInput.setAttribute("data-query-row-target", "notesInput")
    notesInput.value = "My test note"
    const needInput = document.createElement("input")
    needInput.setAttribute("data-query-row-target", "informationNeedInput")
    needInput.value = "Find relevant docs"
    const indicator = document.createElement("span")
    indicator.className = "d-none"
    indicator.setAttribute("data-query-row-target", "notesSavedIndicator")
    panel.appendChild(notesInput)
    panel.appendChild(needInput)
    panel.appendChild(indicator)
    el.appendChild(panel)

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ notes: "My test note", information_need: "Find relevant docs" }),
    })

    try {
      const ctrl = application.getControllerForElementAndIdentifier(el, "query-row")
      await ctrl.saveNotes()

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      const [url, opts] = fetchSpy.mock.calls[0]
      expect(String(url)).toContain("api/cases/1/queries/99/notes")
      expect(opts.method).toBe("PUT")
      const body = JSON.parse(opts.body)
      expect(body.query.notes).toBe("My test note")
      expect(body.query.information_need).toBe("Find relevant docs")
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it("expand fetches try config then uses splainer-search searcher", async () => {
    const tryJson = {
      search_engine: "solr",
      search_url: "http://solr.test/select",
      args: { q: ["#$query##"], rows: [10] },
      field_spec: "title id",
      number_of_rows: 10,
      proxy_requests: true,
    }

    // Configure mock searcher to return docs
    mockSearcher.docs = [{ id: "42", title: "Hello Doc", _source: { id: "42", title: "Hello Doc" } }]
    mockSearcher.numFound = 99
    mockSearcher.linkUrl = "http://solr.test/select?q=test+query&indent=true"

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const u = String(url)
      if (u.includes("api/cases/1/tries/1")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(tryJson) })
      }
      return Promise.reject(new Error(`unexpected fetch: ${u}`))
    })

    try {
      const el = document.querySelector("[data-controller=query-row]")
      const ctrl = application.getControllerForElementAndIdentifier(el, "query-row")

      await ctrl.expand()

      await waitFor(() => {
        expect(ctrl.searchLoaded).toBe(true)
      })

      expect(ctrl.resultsContainerTarget.textContent).toContain("Hello Doc")
      expect(ctrl.resultsContainerTarget.textContent).toContain("99 results found")
      expect(ctrl.lastNumFound).toBe(99)
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it("toggleDocExplain toggles debugMode and reruns search", () => {
    const el = document.querySelector("[data-controller=query-row]")
    const btn = document.createElement("button")
    btn.setAttribute("data-query-row-target", "docExplainToggle")
    el.appendChild(btn)

    const ctrl = application.getControllerForElementAndIdentifier(el, "query-row")
    const runSpy = vi.spyOn(ctrl, "runSearch").mockResolvedValue(undefined)

    try {
      ctrl.toggleDocExplain({ preventDefault: vi.fn() })
      expect(ctrl.debugMode).toBe(true)
      expect(btn.classList.contains("btn-info")).toBe(true)
      expect(runSpy).toHaveBeenCalledTimes(1)

      ctrl.toggleDocExplain({ preventDefault: vi.fn() })
      expect(ctrl.debugMode).toBe(false)
      expect(btn.classList.contains("btn-outline-secondary")).toBe(true)
      expect(runSpy).toHaveBeenCalledTimes(2)
    } finally {
      runSpy.mockRestore()
    }
  })

  it("explainQuery dispatches show-query-explain with lastResult data", async () => {
    const el = document.querySelector("[data-controller=query-row]")
    const ctrl = application.getControllerForElementAndIdentifier(el, "query-row")
    const listener = vi.fn()
    document.addEventListener("show-query-explain", listener)

    try {
      ctrl.searchLoaded = true
      ctrl.lastResult = {
        queryDetails: { foo: "bar" },
        parsedQueryDetails: { baz: 1 },
        renderedTemplate: "http://example/solr?q=wired",
        docs: [],
        numFound: 0,
      }

      ctrl.explainQuery({ preventDefault: vi.fn() })

      expect(listener).toHaveBeenCalledTimes(1)
      const evt = listener.mock.calls[0][0]
      expect(evt.detail.queryDetails).toEqual({ foo: "bar" })
      expect(evt.detail.parsedQueryDetails).toEqual({ baz: 1 })
      expect(evt.detail.renderedTemplate).toBe("http://example/solr?q=wired")
    } finally {
      document.removeEventListener("show-query-explain", listener)
    }
  })
})
