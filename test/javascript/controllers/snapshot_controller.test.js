import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { Application } from "@hotwired/stimulus"
import SnapshotController from "../../../app/javascript/controllers/snapshot_controller"
import QueryRowController from "../../../app/javascript/controllers/query_row_controller"
import FlashController from "../../../app/javascript/controllers/flash_controller"
import { waitForController } from "../support/stimulus_helpers"

describe("SnapshotController", () => {
  let application
  const originalFetch = global.fetch

  beforeEach(async () => {
    document.head.innerHTML = '<meta name="csrf-token" content="test-csrf">'
    document.body.setAttribute("data-case-id", "42")
    document.body.setAttribute("data-try-number", "1")
    document.body.setAttribute("data-scorer-scale", "[0,1,2,3]")
    document.body.setAttribute("data-quepid-root-url", "")

    document.body.innerHTML = `
      <div id="main-content" data-controller="flash">
        <div data-flash-target="container"></div>
        <div data-controller="snapshot"
             data-snapshot-query-row-outlet="[data-controller='query-row']">

          <a href="#" data-action="click->snapshot#open">Create snapshot</a>

          <div class="modal fade" tabindex="-1" data-snapshot-target="modal">
            <div class="modal-dialog">
              <div class="modal-content">
                <form data-action="submit->snapshot#submit">
                  <input type="text" data-snapshot-target="nameInput" value="">
                  <div class="d-none" data-snapshot-target="errorMessage"></div>
                  <div class="d-none" data-snapshot-target="progressMessage"></div>
                  <button type="submit" data-snapshot-target="submitButton">Take Snapshot</button>
                </form>
              </div>
            </div>
          </div>
        </div>

        <li data-controller="query-row"
            data-query-row-query-id-value="10"
            data-query-row-query-text-value="shoes"
            data-query-row-ratings-value='{}'>
          <div data-query-row-target="expandedContent" class="d-none"></div>
          <span data-query-row-target="chevron" class="bi bi-chevron-down"></span>
          <small data-query-row-target="totalResults"></small>
          <div data-query-row-target="scoreDisplay">--</div>
          <div data-query-row-target="resultsContainer"></div>
        </li>
      </div>
    `

    // Stub Bootstrap modal
    window.bootstrap = {
      Modal: {
        getOrCreateInstance: vi.fn(() => ({
          show: vi.fn(),
          hide: vi.fn(),
        })),
      },
    }

    application = Application.start()
    application.register("snapshot", SnapshotController)
    application.register("query-row", QueryRowController)
    application.register("flash", FlashController)
    await waitForController(application, '[data-controller="flash"]', "flash")
    await waitForController(application, '[data-controller="snapshot"]', "snapshot")
    await waitForController(application, '[data-controller="query-row"]', "query-row")
  })

  afterEach(() => {
    if (application) application.stop()
    delete window.bootstrap
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it("builds payload from query-row outlets", () => {
    const snapshotEl = document.querySelector('[data-controller="snapshot"]')
    const ctrl = application.getControllerForElementAndIdentifier(snapshotEl, "snapshot")

    // Simulate search results on the query-row
    const queryRowEl = document.querySelector('[data-controller="query-row"]')
    const rowCtrl = application.getControllerForElementAndIdentifier(queryRowEl, "query-row")
    rowCtrl.lastSearchDocs = [
      {
        id: "doc-1",
        title: "Red Shoes",
        subs: { brand: "Nike" },
        explain: '{"match": true}',
        _source: { name: "Red Shoes", brand: "Nike" },
      },
      {
        id: "doc-2",
        title: "Blue Shoes",
        subs: { brand: "Adidas" },
        _source: { name: "Blue Shoes", brand: "Adidas" },
      },
    ]
    rowCtrl.lastNumFound = 50
    rowCtrl.currentScore = 0.75

    const payload = ctrl._buildPayload("Test Snapshot")

    expect(payload.snapshot.name).toBe("Test Snapshot")
    expect(payload.snapshot.queries["10"]).toEqual({
      score: 0.75,
      all_rated: false,
      number_of_results: 50,
    })
    expect(payload.snapshot.docs["10"]).toHaveLength(2)
    expect(payload.snapshot.docs["10"][0]).toEqual({
      id: "doc-1",
      explain: '{"match": true}',
      rated_only: false,
      fields: { name: "Red Shoes", brand: "Nike" },
    })
    expect(payload.snapshot.docs["10"][1].fields.brand).toBe("Adidas")
  })

  it("includes rated-only docs not in search results", () => {
    const snapshotEl = document.querySelector('[data-controller="snapshot"]')
    const ctrl = application.getControllerForElementAndIdentifier(snapshotEl, "snapshot")

    const queryRowEl = document.querySelector('[data-controller="query-row"]')
    const rowCtrl = application.getControllerForElementAndIdentifier(queryRowEl, "query-row")
    rowCtrl.lastSearchDocs = [{ id: "doc-1", title: "A", subs: {} }]
    rowCtrl.lastNumFound = 1
    // Manually add a rating for a doc not in search results
    rowCtrl.ratingsStore.ratings["doc-99"] = 3

    const payload = ctrl._buildPayload("With Rated")

    const docIds = payload.snapshot.docs["10"].map((d) => d.id)
    expect(docIds).toContain("doc-99")
    const ratedOnlyDoc = payload.snapshot.docs["10"].find((d) => d.id === "doc-99")
    expect(ratedOnlyDoc.rated_only).toBe(true)
  })

  it("submits snapshot via fetch and shows success flash", async () => {
    const snapshotEl = document.querySelector('[data-controller="snapshot"]')
    const ctrl = application.getControllerForElementAndIdentifier(snapshotEl, "snapshot")

    // Populate search results so the no-results guard passes
    const queryRowEl = document.querySelector('[data-controller="query-row"]')
    const rowCtrl = application.getControllerForElementAndIdentifier(queryRowEl, "query-row")
    rowCtrl.lastSearchDocs = [{ id: "doc-1", title: "A", subs: {} }]
    rowCtrl.lastNumFound = 1

    ctrl.nameInputTarget.value = "My Snapshot"

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: 1, name: "My Snapshot" }),
      }),
    )

    await ctrl.submit(new Event("submit", { cancelable: true }))

    expect(global.fetch).toHaveBeenCalledOnce()
    const [url, opts] = global.fetch.mock.calls[0]
    expect(url).toBe("api/cases/42/snapshots")
    expect(opts.method).toBe("POST")
    expect(JSON.parse(opts.body).snapshot.name).toBe("My Snapshot")

    // Flash message should appear
    const alert = document.querySelector(".alert-success")
    expect(alert).not.toBeNull()
    expect(alert.textContent).toContain("Snapshot created successfully")
  })

  it("shows error when name is empty", async () => {
    const snapshotEl = document.querySelector('[data-controller="snapshot"]')
    const ctrl = application.getControllerForElementAndIdentifier(snapshotEl, "snapshot")

    ctrl.nameInputTarget.value = "   "

    await ctrl.submit(new Event("submit", { cancelable: true }))

    expect(ctrl.errorMessageTarget.classList.contains("d-none")).toBe(false)
    expect(ctrl.errorMessageTarget.textContent).toContain("required")
  })

  it("shows error when no searches have been run", async () => {
    const snapshotEl = document.querySelector('[data-controller="snapshot"]')
    const ctrl = application.getControllerForElementAndIdentifier(snapshotEl, "snapshot")

    ctrl.nameInputTarget.value = "Empty Snapshot"
    // lastSearchDocs defaults to [] — no searches run

    await ctrl.submit(new Event("submit", { cancelable: true }))

    expect(ctrl.errorMessageTarget.classList.contains("d-none")).toBe(false)
    expect(ctrl.errorMessageTarget.textContent).toContain("No search results loaded")
  })

  it("shows error on API failure", async () => {
    const snapshotEl = document.querySelector('[data-controller="snapshot"]')
    const ctrl = application.getControllerForElementAndIdentifier(snapshotEl, "snapshot")

    // Populate search results so the no-results guard passes
    const queryRowEl = document.querySelector('[data-controller="query-row"]')
    const rowCtrl = application.getControllerForElementAndIdentifier(queryRowEl, "query-row")
    rowCtrl.lastSearchDocs = [{ id: "doc-1", title: "A", subs: {} }]
    rowCtrl.lastNumFound = 1

    ctrl.nameInputTarget.value = "Fail Snapshot"

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      }),
    )

    await ctrl.submit(new Event("submit", { cancelable: true }))

    expect(ctrl.errorMessageTarget.classList.contains("d-none")).toBe(false)
    expect(ctrl.errorMessageTarget.textContent).toContain("500")
  })
})
