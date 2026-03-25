import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { waitFor } from "@testing-library/dom"
import { Application } from "@hotwired/stimulus"
import AddQueryController from "../../../app/javascript/controllers/add_query_controller"
import { waitForController } from "../support/stimulus_helpers"

function mockJsonResponse(data) {
  return { ok: true, json: () => Promise.resolve(data) }
}

describe("AddQueryController", () => {
  let application

  beforeEach(async () => {
    document.head.innerHTML = '<meta name="csrf-token" content="test-token">'
    document.body.innerHTML = `
      <div id="query-list-shell" data-query-list-sortable-value="false">
        <form data-controller="add-query"
              data-add-query-url-value="api/cases/1/queries"
              data-add-query-bulk-url-value="api/bulk/cases/1/queries"
              data-action="submit->add-query#submit">
          <input data-add-query-target="input" type="text" />
          <input type="submit" value="Add query" />
        </form>
        <span data-query-list-target="queryCount">0</span>
        <ul class="results-list-element" data-query-list-target="list"></ul>
      </div>
    `

    application = Application.start()
    application.register("add-query", AddQueryController)
    await waitForController(application, '[data-controller="add-query"]', "add-query")
  })

  afterEach(() => {
    application.stop()
    vi.unstubAllGlobals()
  })

  it("does nothing when input is empty", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockJsonResponse({}))
    const form = document.querySelector("form")

    form.dispatchEvent(new Event("submit", { bubbles: true }))
    await Promise.resolve()

    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it("sends POST with single query text", async () => {
    const queryData = { query: { query_id: 42, query_text: "star wars", ratings: {}, notes: "", information_need: "" } }
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockJsonResponse(queryData))

    const input = document.querySelector('[data-add-query-target="input"]')
    const form = document.querySelector("form")

    input.value = "star wars"
    form.dispatchEvent(new Event("submit", { bubbles: true }))
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled()
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      "api/cases/1/queries",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ query: { query_text: "star wars" } }),
      }),
    )

    fetchSpy.mockRestore()
  })

  it("sends bulk POST for semicolon-separated queries", async () => {
    const bulkData = {
      queries: [
        { query_id: 42, query_text: "star wars", ratings: {} },
        { query_id: 43, query_text: "lord of the rings", ratings: {} },
      ],
    }
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockJsonResponse(bulkData))

    const input = document.querySelector('[data-add-query-target="input"]')
    const form = document.querySelector("form")

    input.value = "star wars; lord of the rings"
    form.dispatchEvent(new Event("submit", { bubbles: true }))
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled()
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      "api/bulk/cases/1/queries",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ queries: ["star wars", "lord of the rings"] }),
      }),
    )

    fetchSpy.mockRestore()
  })

  it("clears input after successful submission", async () => {
    const queryData = { query: { query_id: 42, query_text: "test query", ratings: {} } }
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockJsonResponse(queryData))

    const input = document.querySelector('[data-add-query-target="input"]')
    const form = document.querySelector("form")

    input.value = "test query"
    form.dispatchEvent(new Event("submit", { bubbles: true }))
    await waitFor(() => {
      expect(input.value).toBe("")
    })

    fetchSpy.mockRestore()
  })

  it("inserts new query row into the list", async () => {
    const queryData = {
      query: { query_id: 99, query_text: "new query", ratings: {}, notes: "", information_need: "" },
    }
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockJsonResponse(queryData))

    const input = document.querySelector('[data-add-query-target="input"]')
    const form = document.querySelector("form")

    input.value = "new query"
    form.dispatchEvent(new Event("submit", { bubbles: true }))

    await waitFor(() => {
      const rows = document.querySelectorAll("[data-query-list-target='queryRow']")
      expect(rows.length).toBe(1)
    })

    const row = document.querySelector("[data-query-list-target='queryRow']")
    expect(row.dataset.queryId).toBe("99")
    expect(row.querySelector(".query").textContent).toContain("new query")

    fetchSpy.mockRestore()
  })

  it("does not insert duplicate query rows", async () => {
    const queryData = {
      query: { query_id: 42, query_text: "star wars", ratings: {}, notes: "", information_need: "" },
    }
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockJsonResponse(queryData))

    const input = document.querySelector('[data-add-query-target="input"]')
    const form = document.querySelector("form")

    // Submit twice with same response
    input.value = "star wars"
    form.dispatchEvent(new Event("submit", { bubbles: true }))
    await waitFor(() => {
      expect(document.querySelectorAll("[data-query-list-target='queryRow']").length).toBe(1)
    })

    input.value = "star wars"
    form.dispatchEvent(new Event("submit", { bubbles: true }))
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    })

    // Should still be just one row
    expect(document.querySelectorAll("[data-query-list-target='queryRow']").length).toBe(1)

    fetchSpy.mockRestore()
  })

  it("shows notes indicator when query has notes", async () => {
    const queryData = {
      query: { query_id: 50, query_text: "noted query", ratings: {}, notes: "important", information_need: "" },
    }
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockJsonResponse(queryData))

    const input = document.querySelector('[data-add-query-target="input"]')
    const form = document.querySelector("form")

    input.value = "noted query"
    form.dispatchEvent(new Event("submit", { bubbles: true }))

    await waitFor(() => {
      const row = document.querySelector("[data-query-list-target='queryRow']")
      expect(row).toBeTruthy()
    })

    const indicator = document.querySelector(".query-notes-indicator")
    expect(indicator).toBeTruthy()

    fetchSpy.mockRestore()
  })
})
