import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { waitFor } from "@testing-library/dom"
import { Application } from "@hotwired/stimulus"
import AddQueryController from "../../../app/javascript/controllers/add_query_controller"
import { waitForController } from "../support/stimulus_helpers"

describe("AddQueryController", () => {
  let application

  function stubLocationReload() {
    vi.stubGlobal("location", {
      reload: vi.fn(),
      href: "http://localhost/",
      assign: vi.fn(),
      replace: vi.fn(),
    })
  }

  beforeEach(async () => {
    document.head.innerHTML = '<meta name="csrf-token" content="test-token">'
    document.body.innerHTML = `
      <form data-controller="add-query"
            data-add-query-url-value="api/cases/1/queries"
            data-add-query-bulk-url-value="api/bulk/cases/1/queries"
            data-action="submit->add-query#submit">
        <input data-add-query-target="input" type="text" />
        <input type="submit" value="Add query" />
      </form>
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
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true })
    const form = document.querySelector("form")

    form.dispatchEvent(new Event("submit", { bubbles: true }))
    await Promise.resolve()

    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it("sends POST with single query text", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true })
    stubLocationReload()

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
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true })
    stubLocationReload()

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
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true })
    stubLocationReload()

    const input = document.querySelector('[data-add-query-target="input"]')
    const form = document.querySelector("form")

    input.value = "test query"
    form.dispatchEvent(new Event("submit", { bubbles: true }))
    await waitFor(() => {
      expect(input.value).toBe("")
    })

    fetchSpy.mockRestore()
  })
})
