import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { Application } from "@hotwired/stimulus"
import QueryRowController from "../../../app/javascript/controllers/query_row_controller"
import { waitForController } from "../support/stimulus_helpers"

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
        <div data-query-row-target="expandedContent" style="display:none"></div>
        <span data-query-row-target="chevron" class="glyphicon glyphicon-chevron-down"></span>
        <small data-query-row-target="totalResults"></small>
        <div data-query-row-target="scoreDisplay">--</div>
        <div data-query-row-target="resultsContainer"><p>placeholder</p></div>
      </li>
    `

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
    expect(ctrl.expandedContentTarget.style.display).toBe("block")
    expect(ctrl.chevronTarget.classList.contains("glyphicon-chevron-up")).toBe(true)
  })

  it("collapse hides content and flips chevron", () => {
    const el = document.querySelector("[data-controller=query-row]")
    const ctrl = application.getControllerForElementAndIdentifier(el, "query-row")
    ctrl.expanded = true
    ctrl.expandedContentTarget.style.display = "block"
    ctrl.chevronTarget.classList.remove("glyphicon-chevron-down")
    ctrl.chevronTarget.classList.add("glyphicon-chevron-up")

    ctrl.collapse()

    expect(ctrl.expanded).toBe(false)
    expect(ctrl.expandedContentTarget.style.display).toBe("none")
    expect(ctrl.chevronTarget.classList.contains("glyphicon-chevron-down")).toBe(true)
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
})
