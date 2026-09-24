import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import MatchExplainController from "controllers/match_explain_controller"

const popoverHandle = {
  setTitle: vi.fn(),
  setBody: vi.fn(),
  dispose: vi.fn(),
  instance: { hide: vi.fn() }
}

vi.mock("utils/bs_popover", () => ({
  createBsPopover: vi.fn(() => popoverHandle)
}))

const dynamicModal = { element: document.createElement("div"), dispose: vi.fn() }

vi.mock("utils/dynamic_modal", () => ({
  openDynamicModal: vi.fn(({ templateId }) => {
    dynamicModal.element = document.createElement("div")
    if (templateId === "match-explain-debug-modal-template") {
      dynamicModal.element.innerHTML = '<em data-modal-target="title"></em><span data-modal-target="docId"></span><div data-modal-target="json"></div>'
    } else {
      dynamicModal.element.innerHTML = '<span data-modal-target="score"></span><pre data-modal-target="explanation"></pre>'
    }
    return dynamicModal
  })
}))

vi.mock("utils/json_explorer", () => ({
  renderJsonExplorer: vi.fn(),
  escapeHtml: (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}))

import { createBsPopover } from "utils/bs_popover"
import { openDynamicModal } from "utils/dynamic_modal"
import { renderJsonExplorer } from "utils/json_explorer"

const FEW_HOTS = [
  { description: "weight(title:foo)", percentage: 62.5 },
  { description: "weight(body:foo)", percentage: 25 }
]

const MANY_HOTS = [
  { description: "a", percentage: 40 },
  { description: "b", percentage: 30 },
  { description: "c", percentage: 20 },
  { description: "d", percentage: 8 },
  { description: "e", percentage: 2 }
]

function baseData(overrides = {}) {
  return {
    hasChildren: true,
    hots: FEW_HOTS,
    explainToStr: "3.5 weight(title:foo)\n",
    explainAsJson: null,
    explainRawStr: JSON.stringify({ description: "weight(title:foo)", value: 3.5 }),
    docTitle: "Some Doc",
    docId: "doc-1",
    docScore: 3.5,
    ...overrides
  }
}

function buildController(element, data) {
  const controller = Object.create(MatchExplainController.prototype)
  controller.element = element
  controller.dataValue = data
  return controller
}

function lastBody() {
  return popoverHandle.setBody.mock.calls.at(-1)[0]
}

describe("MatchExplainController", () => {
  let element

  beforeEach(() => {
    element = document.createElement("div")
    document.body.appendChild(element)
    vi.clearAllMocks()

    window.bootstrap = {
      Collapse: class CollapseMock {
        constructor(el) {
          this.element = el
          this.disposed = false
        }

        show() {
          this.element.classList.add("show")
        }

        hide() {
          this.element.classList.remove("show")
        }

        dispose() {
          this.disposed = true
        }
      }
    }
  })

  afterEach(() => {
    element.remove()
    delete window.bootstrap
  })

  it("creates the popover once on connect, attached to a stable trigger", () => {
    const controller = buildController(element, baseData())
    MatchExplainController.prototype.connect.call(controller)

    expect(createBsPopover).toHaveBeenCalledTimes(1)
    const [trigger, options] = createBsPopover.mock.calls[0]
    expect(trigger).toBe(element.querySelector(".matches-popper"))
    expect(options.mode).toBe("text")
    expect(options.trigger).toBe("outsideClick")
    expect(options.placement).toBe("left")
    expect(popoverHandle.setTitle).toHaveBeenCalledWith("Relevancy Score: 3.5")
  })

  it("shows the Matches chip and up to 3 bars when there are 3 or fewer hot matches", () => {
    const controller = buildController(element, baseData())
    MatchExplainController.prototype.connect.call(controller)

    expect(element.querySelector(".matches-popper span").textContent).toBe("Matches")
    expect(element.querySelectorAll(".graph-explain")).toHaveLength(2)
    expect(element.querySelector(".match-explain-toggle")).toBeNull()
  })

  it("shows the No Match chip and the no-breakdown message when the doc has no explain children", () => {
    const controller = buildController(element, baseData({ hasChildren: false, hots: [], explainAsJson: "{}" }))
    MatchExplainController.prototype.connect.call(controller)

    expect(element.querySelector(".matches-popper span").textContent).toBe("No Match")
    expect(element.querySelector(".graph-label").textContent).toBe("no per-term score breakdown for doc")
  })

  it("shows only the first 3 bars plus a collapsed rest and a Show N More toggle beyond 3 hots", () => {
    const controller = buildController(element, baseData({ hots: MANY_HOTS }))
    MatchExplainController.prototype.connect.call(controller)

    const bars = element.querySelectorAll(".graph-explain")
    expect(bars).toHaveLength(5)
    const more = element.querySelector(".match-explain-more")
    expect(more.classList.contains("collapse")).toBe(true)
    expect(more.classList.contains("show")).toBe(false)

    const toggle = element.querySelector(".match-explain-toggle")
    expect(toggle.textContent).toBe("Show 2 More")
  })

  it("toggles the Show More/Less label and the collapse class on click", () => {
    const controller = buildController(element, baseData({ hots: MANY_HOTS }))
    MatchExplainController.prototype.connect.call(controller)

    const toggle = element.querySelector(".match-explain-toggle")
    toggle.click()

    expect(toggle.textContent).toBe("Show Less")
    expect(element.querySelector(".match-explain-more").classList.contains("show")).toBe(true)

    toggle.click()
    expect(toggle.textContent).toBe("Show 2 More")
  })

  it("clamps out-of-range percentages into the progress bar width", () => {
    const controller = buildController(element, baseData({ hots: [{ description: "over", percentage: 140 }] }))
    MatchExplainController.prototype.connect.call(controller)

    const bar = element.querySelector(".progress-bar")
    expect(bar.style.width).toBe("100%")
    expect(bar.getAttribute("aria-valuenow")).toBe("100")
  })

  it("opens Debug Explain when a hot-match bar is clicked", () => {
    const controller = buildController(element, baseData())
    MatchExplainController.prototype.connect.call(controller)

    element.querySelector(".match-explain-bar").click()

    expect(openDynamicModal).toHaveBeenCalledTimes(1)
  })

  it("escapes match descriptions rendered into the bars", () => {
    const controller = buildController(element, baseData({ hots: [{ description: "<b>x</b>", percentage: 10 }] }))
    MatchExplainController.prototype.connect.call(controller)

    expect(element.querySelector(".graph-label").textContent).toBe("<b>x</b>")
  })

  it("popover body shows the explain tree and disables Debug when there are no explain children", () => {
    const controller = buildController(element, baseData({ hasChildren: false, hots: [], explainAsJson: "{}" }))
    MatchExplainController.prototype.connect.call(controller)

    const body = lastBody()
    expect(body.querySelector(".doc-score-explanation pre").textContent).toBe("{}")
    expect(body.querySelector(".match-explain-debug").classList.contains("disabled")).toBe(true)
    expect(body.querySelector(".match-explain-debug").getAttribute("aria-disabled")).toBe("true")

    body.querySelector(".match-explain-debug").click()
    expect(openDynamicModal).not.toHaveBeenCalled()
  })

  it("Debug opens a modal sized lg with the doc-detailed-explain-modal class and renders the JSON explorer", () => {
    const data = baseData()
    const controller = buildController(element, data)
    MatchExplainController.prototype.connect.call(controller)

    const body = lastBody()
    body.querySelector(".match-explain-debug").click()

    expect(openDynamicModal).toHaveBeenCalledTimes(1)
    const options = openDynamicModal.mock.calls[0][0]
    expect(options.size).toBe("lg")
    expect(options.windowClass).toBe("doc-detailed-explain-modal")
    expect(options.templateId).toBe("match-explain-debug-modal-template")
    expect(dynamicModal.element.querySelector("[data-modal-target='title']").textContent).toBe("Some Doc")
    expect(dynamicModal.element.querySelector("[data-modal-target='docId']").textContent).toBe("doc-1")

    expect(renderJsonExplorer).toHaveBeenCalledTimes(1)
    expect(renderJsonExplorer.mock.calls[0][1]).toBe(data.explainRawStr)
  })

  it("Expand opens a full-screen-modal with the same explanation text", () => {
    const controller = buildController(element, baseData())
    MatchExplainController.prototype.connect.call(controller)

    const body = lastBody()
    body.querySelector(".match-explain-expand").click()

    expect(openDynamicModal).toHaveBeenCalledTimes(1)
    const options = openDynamicModal.mock.calls[0][0]
    expect(options.windowClass).toBe("full-screen-modal")
    expect(options.templateId).toBe("match-explain-expand-modal-template")
    expect(dynamicModal.element.querySelector("[data-modal-target='score']").textContent).toBe("3.5")
    expect(dynamicModal.element.querySelector("[data-modal-target='explanation']").textContent).toContain("3.5 weight(title:foo)")
  })

  it("updates the popover in place (setTitle/setBody) on a data change, without disposing or recreating it", () => {
    const controller = buildController(element, baseData({ hots: MANY_HOTS }))
    MatchExplainController.prototype.connect.call(controller)
    element.querySelector(".match-explain-toggle").click()
    expect(element.querySelector(".match-explain-toggle").textContent).toBe("Show Less")

    MatchExplainController.prototype.dataValueChanged.call(controller, baseData({ hots: MANY_HOTS, docScore: 4.2 }))

    // The whole point of updating in place: an open popover elsewhere on the
    // page (e.g. another doc row) must not get torn down just because this
    // row's data changed, since rating any doc reshuffles every row's
    // maxDocScore-derived data.
    expect(createBsPopover).toHaveBeenCalledTimes(1)
    expect(popoverHandle.dispose).not.toHaveBeenCalled()
    expect(popoverHandle.setTitle).toHaveBeenLastCalledWith("Relevancy Score: 4.2")
    expect(element.querySelector(".match-explain-toggle").textContent).toBe("Show 2 More")
  })

  it("ignores a dataValueChanged that fires before connect() (Stimulus's ValueObserver runs first)", () => {
    const controller = buildController(element, baseData())
    expect(() => MatchExplainController.prototype.dataValueChanged.call(controller, baseData())).not.toThrow()
    expect(createBsPopover).not.toHaveBeenCalled()
  })

  it("disposes the Collapse instance when bars re-render, instead of leaking the old one", () => {
    const controller = buildController(element, baseData({ hots: MANY_HOTS }))
    MatchExplainController.prototype.connect.call(controller)
    const firstCollapse = controller.collapseInstance
    expect(firstCollapse).not.toBeNull()

    MatchExplainController.prototype.dataValueChanged.call(controller, baseData({ hots: MANY_HOTS }))

    expect(firstCollapse.disposed).toBe(true)
    expect(controller.collapseInstance).not.toBe(firstCollapse)
  })

  it("disposes the Collapse instance and the popover on disconnect", () => {
    const controller = buildController(element, baseData({ hots: MANY_HOTS }))
    MatchExplainController.prototype.connect.call(controller)
    const collapse = controller.collapseInstance

    MatchExplainController.prototype.disconnect.call(controller)

    expect(collapse.disposed).toBe(true)
    expect(controller.collapseInstance).toBeNull()
    expect(popoverHandle.dispose).toHaveBeenCalledTimes(1)
    expect(controller.popoverHandle).toBeNull()
  })

  it("ignores a dataValueChanged that fires after disconnect() (triggerEl survives disconnect; popoverHandle doesn't)", () => {
    const controller = buildController(element, baseData())
    MatchExplainController.prototype.connect.call(controller)
    MatchExplainController.prototype.disconnect.call(controller)
    vi.clearAllMocks()

    expect(() => MatchExplainController.prototype.dataValueChanged.call(controller, baseData())).not.toThrow()
    expect(popoverHandle.setTitle).not.toHaveBeenCalled()
    expect(popoverHandle.setBody).not.toHaveBeenCalled()
  })
})
