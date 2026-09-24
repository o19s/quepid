import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import QueryExplainController from "controllers/query_explain_controller"

const dynamicModal = { element: document.createElement("div"), dispose: vi.fn() }

// Unlike match-explain's tests, these assert on real DOM structure inside the
// modal (tab clicks, copy buttons, the async template-render round trip), so
// the mock actually renders `html` into `element` rather than leaving it empty.
vi.mock("utils/dynamic_modal", () => ({
  openDynamicModal: vi.fn(({ html, templateId }) => {
    dynamicModal.element.innerHTML = html || document.getElementById(templateId).innerHTML
    return dynamicModal
  })
}))

vi.mock("utils/clipboard", () => ({
  copyText: vi.fn().mockResolvedValue()
}))

vi.mock("utils/json_explorer", () => ({
  renderJsonExplorer: vi.fn(),
  escapeHtml: (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}))

import { openDynamicModal } from "utils/dynamic_modal"
import { copyText } from "utils/clipboard"
import { renderJsonExplorer } from "utils/json_explorer"

function baseData(overrides = {}) {
  return {
    queryDetails: '{"q":"foo"}',
    parsedQueryDetails: '{"parsed":"foo"}',
    queryDetailsMessage: null,
    supportsTemplate: false,
    ...overrides
  }
}

function buildController(element, data) {
  const controller = Object.create(QueryExplainController.prototype)
  controller.element = element
  controller.dataValue = data
  return controller
}

function shownTab(el, tabId) {
  el.querySelector(`#${tabId}`).dispatchEvent(new Event("shown.bs.tab"))
}

describe("QueryExplainController", () => {
  let element

  beforeEach(() => {
    element = document.createElement("div")
    document.body.appendChild(element)
    vi.clearAllMocks()
    dynamicModal.element = document.createElement("div")
    const template = document.createElement("template")
    template.id = "query-explain-modal-template"
    template.innerHTML = `<div class="query-explain-params"></div><div class="query-explain-parsing"></div><div class="query-explain-template"><p data-modal-target="templateMessage"></p><pre data-modal-target="templateValue"></pre></div><p data-modal-target="paramsMessage"><i data-modal-target="paramsWarningIcon"></i><span data-modal-target="paramsMessageText"></span></p><button id="query-explain-tab-params"></button><button id="query-explain-tab-parsing"></button><button id="query-explain-tab-template"></button><button class="query-explain-copy" data-tab="queryDetails"></button><button class="query-explain-copy d-none" data-tab="parsedQueryDetails"></button><button class="query-explain-copy d-none" data-tab="renderedQueryTemplate"></button>`
    document.body.appendChild(template)
  })

  afterEach(() => {
    element.remove()
    document.getElementById("query-explain-modal-template")?.remove()
  })

  it("renders an Explain Query trigger button on connect", () => {
    const controller = buildController(element, baseData())
    QueryExplainController.prototype.connect.call(controller)

    const button = element.querySelector("button")
    expect(button.textContent.trim()).toBe("Explain Query")
  })

  it("opens a lg modal on click and renders the Params/Parsing json trees", () => {
    const data = baseData()
    const controller = buildController(element, data)
    QueryExplainController.prototype.connect.call(controller)
    element.querySelector("button").click()

    expect(openDynamicModal).toHaveBeenCalledTimes(1)
    const options = openDynamicModal.mock.calls[0][0]
    expect(options.size).toBe("lg")
    expect(options.templateId).toBe("query-explain-modal-template")

    expect(renderJsonExplorer).toHaveBeenCalledWith(
      dynamicModal.element.querySelector(".query-explain-params"),
      data.queryDetails,
      { collapsed: false }
    )
    expect(renderJsonExplorer).toHaveBeenCalledWith(
      dynamicModal.element.querySelector(".query-explain-parsing"),
      data.parsedQueryDetails,
      { collapsed: false }
    )
  })

  it("refreshes its data synchronously before opening", () => {
    const controller = buildController(element, baseData({ queryDetails: "stale" }))
    QueryExplainController.prototype.connect.call(controller)
    element.addEventListener("query-explain:before-open", event => {
      event.detail.data = baseData({ queryDetails: "fresh" })
    })

    element.querySelector("button").click()

    expect(renderJsonExplorer).toHaveBeenCalledWith(
      dynamicModal.element.querySelector(".query-explain-params"),
      "fresh",
      { collapsed: false }
    )
  })

  it("shows a warning instead of the Params tree when queryDetailsMessage is set", () => {
    const data = baseData({ queryDetails: null, queryDetailsMessage: "Query parameters are not returned by the current Search Engine." })
    const controller = buildController(element, data)
    QueryExplainController.prototype.connect.call(controller)
    element.querySelector("button").click()

    expect(dynamicModal.element.textContent).toContain("Query parameters are not returned by the current Search Engine.")
    expect(renderJsonExplorer).not.toHaveBeenCalledWith(
      dynamicModal.element.querySelector(".query-explain-params"),
      expect.anything(),
      expect.anything()
    )
  })

  it("only shows the Params copy button until another tab is shown, then switches", () => {
    const controller = buildController(element, baseData())
    QueryExplainController.prototype.connect.call(controller)
    element.querySelector("button").click()

    const el = dynamicModal.element
    const copyButtons = () => [...el.querySelectorAll(".query-explain-copy")]
    expect(copyButtons().filter((b) => !b.classList.contains("d-none")).map((b) => b.dataset.tab)).toEqual(["queryDetails"])

    shownTab(el, "query-explain-tab-parsing")
    expect(copyButtons().filter((b) => !b.classList.contains("d-none")).map((b) => b.dataset.tab)).toEqual(["parsedQueryDetails"])
  })

  it("copies the active tab's text to the clipboard", () => {
    const data = baseData()
    const controller = buildController(element, data)
    QueryExplainController.prototype.connect.call(controller)
    element.querySelector("button").click()

    const el = dynamicModal.element
    el.querySelector('.query-explain-copy[data-tab="queryDetails"]').click()
    expect(copyText).toHaveBeenCalledWith(data.queryDetails)
  })

  it("shows 'not a templated query' and never asks Angular to render when the searcher has no isTemplateCall", () => {
    const controller = buildController(element, baseData({ supportsTemplate: false }))
    QueryExplainController.prototype.connect.call(controller)
    element.querySelector("button").click()

    const el = dynamicModal.element
    const dispatchSpy = vi.spyOn(controller.element, "dispatchEvent")
    shownTab(el, "query-explain-tab-template")

    expect(el.querySelector(".query-explain-template").textContent).toContain("This is not a templated query.")
    expect(dispatchSpy).not.toHaveBeenCalled()
  })

  it("requests the rendered template from Angular when the tab is shown, and renders the response", () => {
    const controller = buildController(element, baseData({ supportsTemplate: true }))
    QueryExplainController.prototype.connect.call(controller)
    element.querySelector("button").click()
    const el = dynamicModal.element

    let requestEvent = null
    controller.element.addEventListener("query-explain:render-template", (event) => { requestEvent = event })
    shownTab(el, "query-explain-tab-template")

    expect(requestEvent).not.toBeNull()
    expect(requestEvent.bubbles).toBe(true)
    expect(el.querySelector(".query-explain-template").textContent).toContain("Rendering query template")

    controller.element.dispatchEvent(new CustomEvent("query-explain:template-rendered", {
      detail: { isTemplatedQuery: true, renderedQueryTemplate: '{"template":"rendered"}' }
    }))

    expect(el.querySelector(".query-explain-template-json").textContent).toBe('{"template":"rendered"}')

    el.querySelector('.query-explain-copy[data-tab="renderedQueryTemplate"]').click()
    expect(copyText).toHaveBeenCalledWith('{"template":"rendered"}')
  })

  it("shows 'not a templated query' when Angular reports the query isn't templated after all", () => {
    const controller = buildController(element, baseData({ supportsTemplate: true }))
    QueryExplainController.prototype.connect.call(controller)
    element.querySelector("button").click()
    const el = dynamicModal.element
    shownTab(el, "query-explain-tab-template")

    controller.element.dispatchEvent(new CustomEvent("query-explain:template-rendered", {
      detail: { isTemplatedQuery: false }
    }))

    expect(el.querySelector(".query-explain-template").textContent).toContain("This is not a templated query.")
  })

  it("shows a warning when Angular reports an error rendering the template", () => {
    const controller = buildController(element, baseData({ supportsTemplate: true }))
    QueryExplainController.prototype.connect.call(controller)
    element.querySelector("button").click()
    const el = dynamicModal.element
    shownTab(el, "query-explain-tab-template")

    controller.element.dispatchEvent(new CustomEvent("query-explain:template-rendered", {
      detail: { isTemplatedQuery: true, error: true }
    }))

    expect(el.querySelector(".query-explain-template").textContent).toContain("Unable to render the query template.")
  })
})
