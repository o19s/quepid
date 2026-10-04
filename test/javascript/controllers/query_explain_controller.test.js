import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import QueryExplainController from "controllers/query_explain_controller"
import { buildControllerFixture } from "../support/controller_fixture"

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

function buildController(element, data, renderQueryTemplate = vi.fn()) {
  const queriesList = { explainData: vi.fn(() => data), renderQueryTemplate }
  return buildControllerFixture(QueryExplainController, {
    element,
    values: { queryId: 7 },
    outlets: { queriesList }
  })
}

// Lets the awaited outlet promise settle before asserting on the rendered pane.
const flush = () => new Promise(resolve => setTimeout(resolve))

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
    template.innerHTML = `<div class="query-explain-params"></div><div class="query-explain-parsing"></div><div class="query-explain-template"><p data-modal-target="templateMessage"></p><pre data-modal-target="templateValue"></pre></div><p data-modal-target="paramsMessage"><i data-modal-target="paramsWarningIcon"></i><span data-modal-target="paramsMessageText"></span></p><button id="query-explain-tab-params"></button><button id="query-explain-tab-parsing"></button><button id="query-explain-tab-template"></button><button class="query-explain-copy" data-tab="queryDetails"><i class="bi bi-copy"></i> Copy</button><button class="query-explain-copy d-none" data-tab="parsedQueryDetails"></button><button class="query-explain-copy d-none" data-tab="renderedQueryTemplate"></button>`
    document.body.appendChild(template)
  })

  afterEach(() => {
    element.remove()
    document.getElementById("query-explain-modal-template")?.remove()
    vi.restoreAllMocks()
  })

  it("renders an Explain Query trigger button on connect", () => {
    const controller = buildController(element, baseData())
    QueryExplainController.prototype.connect.call(controller)

    const button = element.querySelector("button")
    expect(button.textContent.trim()).toBe("Explain Query")
    expect(button.dataset.action).toBe("query-explain#requestOpen")
  })

  it("opens a lg modal on click and renders the Params/Parsing json trees", () => {
    const data = baseData()
    const controller = buildController(element, data)
    QueryExplainController.prototype.connect.call(controller)
    controller.requestOpen()

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

  it("reads its data from the queries-list outlet when opening", () => {
    const controller = buildController(element, baseData({ queryDetails: "fresh" }))
    QueryExplainController.prototype.connect.call(controller)

    controller.requestOpen()

    expect(controller.queriesListOutlet.explainData).toHaveBeenCalledWith(7)
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
    controller.requestOpen()

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
    controller.requestOpen()

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
    controller.requestOpen()

    const el = dynamicModal.element
    el.querySelector('.query-explain-copy[data-tab="queryDetails"]').click()
    expect(copyText).toHaveBeenCalledWith(data.queryDetails)
  })

  it("shows Copied! after a successful copy, then restores the label", async () => {
    vi.useFakeTimers()
    try {
      const controller = buildController(element, baseData())
      QueryExplainController.prototype.connect.call(controller)
      controller.requestOpen()
      const button = dynamicModal.element.querySelector('.query-explain-copy[data-tab="queryDetails"]')

      button.click()
      await vi.advanceTimersByTimeAsync(0)
      expect(button.textContent.trim()).toBe("Copied!")
      expect(button.querySelector("i").className).toBe("bi bi-check-lg")

      await vi.advanceTimersByTimeAsync(2000)
      expect(button.innerHTML).toBe('<i class="bi bi-copy"></i> Copy')
    } finally {
      vi.useRealTimers()
    }
  })

  it("shows Copy failed when the clipboard rejects", async () => {
    copyText.mockRejectedValueOnce(new Error("denied"))
    const controller = buildController(element, baseData())
    QueryExplainController.prototype.connect.call(controller)
    controller.requestOpen()
    const button = dynamicModal.element.querySelector('.query-explain-copy[data-tab="queryDetails"]')

    button.click()
    await flush()

    expect(button.textContent.trim()).toBe("Copy failed")
  })

  it("shows 'not a templated query' and never asks for a render when the searcher has no isTemplateCall", () => {
    const controller = buildController(element, baseData({ supportsTemplate: false }))
    QueryExplainController.prototype.connect.call(controller)
    controller.requestOpen()

    const el = dynamicModal.element
    shownTab(el, "query-explain-tab-template")

    expect(el.querySelector(".query-explain-template").textContent).toContain("This is not a templated query.")
    expect(controller.queriesListOutlet.renderQueryTemplate).not.toHaveBeenCalled()
  })

  it("awaits the rendered template from the queries-list outlet when the tab is shown", async () => {
    let resolveRender
    const render = vi.fn(() => new Promise(resolve => { resolveRender = resolve }))
    const controller = buildController(element, baseData({ supportsTemplate: true }), render)
    QueryExplainController.prototype.connect.call(controller)
    controller.requestOpen()
    const el = dynamicModal.element

    shownTab(el, "query-explain-tab-template")

    expect(render).toHaveBeenCalledWith(7)
    expect(el.querySelector(".query-explain-template").textContent).toContain("Rendering query template")

    resolveRender({ isTemplatedQuery: true, renderedQueryTemplate: '{"template":"rendered"}' })
    await flush()

    expect(el.querySelector(".query-explain-template-json").textContent).toBe('{"template":"rendered"}')

    el.querySelector('.query-explain-copy[data-tab="renderedQueryTemplate"]').click()
    expect(copyText).toHaveBeenCalledWith('{"template":"rendered"}')
  })

  it("shows 'not a templated query' when the host reports the query isn't templated after all", async () => {
    const render = vi.fn().mockResolvedValue({ isTemplatedQuery: false })
    const controller = buildController(element, baseData({ supportsTemplate: true }), render)
    QueryExplainController.prototype.connect.call(controller)
    controller.requestOpen()
    const el = dynamicModal.element
    shownTab(el, "query-explain-tab-template")
    await flush()

    expect(el.querySelector(".query-explain-template").textContent).toContain("This is not a templated query.")
  })

  it("shows a warning when rendering the template rejects", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const render = vi.fn().mockRejectedValue(new Error("engine down"))
    const controller = buildController(element, baseData({ supportsTemplate: true }), render)
    QueryExplainController.prototype.connect.call(controller)
    controller.requestOpen()
    const el = dynamicModal.element
    shownTab(el, "query-explain-tab-template")
    await flush()

    expect(el.querySelector(".query-explain-template").textContent).toContain("Unable to render the query template.")
  })

  it("shows the same warning instead of hanging when there is no queries-list outlet", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const controller = buildController(element, baseData({ supportsTemplate: true }))
    QueryExplainController.prototype.connect.call(controller)
    controller.requestOpen()
    const el = dynamicModal.element
    Object.defineProperty(controller, "queriesListOutlet", {
      get() { throw new Error("Missing outlet element \"queries-list\"") }
    })
    shownTab(el, "query-explain-tab-template")
    await flush()

    expect(el.querySelector(".query-explain-template").textContent).toContain("Unable to render the query template.")
  })
})
