import { readFileSync } from "node:fs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Application } from "@hotwired/stimulus"
import AddQueryController from "controllers/add_query_controller"

// Override the unit-test alias for this file, including the controller's import.
vi.mock("@hotwired/stimulus", () => import("../../../node_modules/@hotwired/stimulus/dist/stimulus.js"))
vi.mock("utils/core_capability_access", () => ({ getCoreCapabilities: () => testCapabilities }))

let testCapabilities

describe("add-query ERB wiring with real Stimulus", () => {
  let application
  let form
  let input
  let submit
  let spinner

  beforeEach(async () => {
    testCapabilities = {}
    const source = readFileSync("app/views/core/_queries.html.erb", "utf8")
    // This form is static HTML within a dynamic partial. Keep its actual
    // targets, actions and values; fail if it starts requiring ERB rendering.
    const markup = source.match(/<form\b[\s\S]*?<\/form>/)?.[0]
    expect(markup).toBeDefined()
    expect(markup).not.toContain("<%")
    document.body.innerHTML = markup
    form = document.querySelector('form[data-controller="add-query"]')
    expect(form).not.toBeNull()
    // happy-dom's form proxy returns its underlying element from closest(),
    // breaking Stimulus's scope identity check for document actions. Preserve
    // browser semantics (a matching element is its own closest ancestor).
    const closest = form.closest.bind(form)
    vi.spyOn(form, "closest").mockImplementation(selector => form.matches(selector) ? form : closest(selector))
    input = form.querySelector('input[type="text"]')
    submit = form.querySelector('input[type="submit"]')
    spinner = form.querySelector(".spinner")

    application = Application.start()
    application.register("add-query", AddQueryController)
    await vi.waitFor(() => {
      expect(application.getControllerForElementAndIdentifier(form, "add-query")).not.toBeNull()
      expect(submit.disabled).toBe(true)
    })
  })

  afterEach(async () => {
    // Remove the scope first so Stimulus invokes disconnect and removes paste
    // listeners before stopping its observers.
    form?.remove()
    if (application && form) {
      await vi.waitFor(() => {
        expect(application.getControllerForElementAndIdentifier(form, "add-query")).toBeNull()
      })
    }
    application?.stop()
    vi.restoreAllMocks()
    document.body.replaceChildren()
    testCapabilities = {}
  })

  it("wires input, submit and completion actions to the form targets", () => {
    const submissions = vi.fn()
    form.addEventListener("add-query:submit", submissions)
    expect(input.placeholder).toBe("Add a query to this case")
    expect(spinner.classList.contains("d-none")).toBe(true)

    input.value = " first; second ;; "
    input.dispatchEvent(new Event("input", { bubbles: true }))
    expect(submit.disabled).toBe(false)
    expect(submit.value).toBe("Add queries")

    const event = new Event("submit", { bubbles: true, cancelable: true })
    form.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(submissions).toHaveBeenCalledOnce()
    expect(submissions.mock.calls[0][0].detail.queryTexts).toEqual(["first", "second"])
    expect(input.value).toBe("")
    expect(submit.disabled).toBe(true)
    expect(spinner.classList.contains("d-none")).toBe(false)

    form.dispatchEvent(new CustomEvent("add-query:complete", { detail: { success: false } }))
    expect(spinner.classList.contains("d-none")).toBe(true)
    expect(document.activeElement).toBe(input)
  })

  it("wires the document capability event without clearing input", () => {
    input.value = "unfinished query"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    expect(submit.disabled).toBe(false)

    testCapabilities = { queryCapabilities: {
      getListState: () => ({ canAddQueries: false, addQueryMessage: "Queries are unavailable" })
    } }
    document.dispatchEvent(new CustomEvent("queries-state:changed"))
    expect(submit.disabled).toBe(true)
    expect(input.placeholder).toBe("Queries are unavailable")
    expect(input.value).toBe("unfinished query")

    testCapabilities = {}
    document.dispatchEvent(new CustomEvent("queries-state:changed"))
    expect(submit.disabled).toBe(false)
    expect(input.placeholder).toBe("Add a query to this case")
  })
})
