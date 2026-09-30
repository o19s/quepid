import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { apiFetch } from "api/fetch"
import QgraphController from "controllers/qgraph_controller"

vi.mock("api/fetch", () => ({ apiFetch: vi.fn() }))

const scores = [
  { score: 10, updated_at: "2026-01-01T00:00:00Z" },
  { score: 20, updated_at: "2026-01-02T00:00:00Z" }
]

function json(body, ok = true, status = 200) {
  return { ok, status, json: async () => body }
}

const mounted = []

function mount({ width = 200, height = 50 } = {}) {
  const element = document.createElement("div")
  element.dataset.qgraphCaseId = "5"
  Object.defineProperty(element, "clientWidth", { value: width })
  Object.defineProperty(element, "clientHeight", { value: height })
  const container = document.createElement("div")
  element.appendChild(container)
  document.body.appendChild(element)

  const controller = Object.create(QgraphController.prototype)
  controller.element = element
  controller.hasContainerTarget = true
  controller.containerTarget = container
  controller.scoresUrlValue = "/api/cases/5/scores"
  controller.annotationsUrlValue = "/api/cases/5/annotations"
  controller.maxScoreValue = 100
  mounted.push(controller)
  return { controller, element, container }
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

describe("QgraphController", () => {
  let scoringStore
  let finalize

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "error").mockImplementation(() => {})
    finalize = vi.fn()
    window.vegaEmbed = vi.fn().mockResolvedValue({ finalize })
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      disconnect() {}
    })
    scoringStore = new EventTarget()
    scoringStore.caseScore = { maxScore: 50 }
    window.quepidStore = { scoring: scoringStore }
    apiFetch.mockImplementation(async url => {
      if (url.includes("scores")) return json({ scores })
      return json({ annotations: [{ message: "tuned", updated_at: "2026-01-02T00:00:00Z" }] })
    })
  })
  afterEach(() => {
    // Controllers register document-level listeners; disconnect so they don't leak between tests.
    mounted.splice(0).forEach(controller => controller.disconnect())
    vi.unstubAllGlobals()
    delete window.vegaEmbed
    document.body.innerHTML = ""
  })

  it("loads scores and annotations on connect and draws the graph", async () => {
    const { controller, element } = mount()

    controller.connect()
    await flush()

    expect(apiFetch).toHaveBeenCalledWith("/api/cases/5/scores")
    expect(apiFetch).toHaveBeenCalledWith("/api/cases/5/annotations")
    expect(element.hidden).toBe(false)
    expect(window.vegaEmbed).toHaveBeenCalled()
    const spec = window.vegaEmbed.mock.calls.at(-1)[1]
    expect(JSON.stringify(spec)).toContain("tuned")
  })

  it("stays hidden with fewer than two scores", async () => {
    apiFetch.mockImplementation(async url =>
      url.includes("scores") ? json({ scores: [scores[0]] }) : json({ annotations: [] })
    )
    const { controller, element } = mount()

    controller.connect()
    await flush()

    expect(element.hidden).toBe(true)
    expect(window.vegaEmbed).not.toHaveBeenCalled()
  })

  it("hides and does not draw when scores fail to load", async () => {
    apiFetch.mockImplementation(async url =>
      url.includes("scores") ? json({}, false, 500) : json({ annotations: [] })
    )
    const { controller, element } = mount()

    controller.connect()
    await flush()

    expect(controller.scores).toEqual([])
    expect(element.hidden).toBe(true)
  })

  it("still draws scores when annotations fail to load", async () => {
    apiFetch.mockImplementation(async url =>
      url.includes("scores") ? json({ scores }) : Promise.reject(new Error("offline"))
    )
    const { controller } = mount()

    controller.connect()
    await flush()

    expect(controller.annotations).toEqual([])
    expect(window.vegaEmbed).toHaveBeenCalled()
  })

  it("does not draw into a zero-size element", async () => {
    const { controller } = mount({ width: 0, height: 0 })

    controller.connect()
    await flush()

    expect(window.vegaEmbed).not.toHaveBeenCalled()
  })

  it("redraws with the store's max score when scoring completes", async () => {
    const { controller } = mount()
    controller.connect()
    await flush()
    window.vegaEmbed.mockClear()

    scoringStore.dispatchEvent(new Event("scoring-complete"))
    await flush()

    expect(controller.maxScore).toBe(50)
    expect(window.vegaEmbed).toHaveBeenCalledTimes(1)
  })

  it("reloads scores only for its own case when a score is persisted", async () => {
    const { controller } = mount()
    controller.connect()
    await flush()
    apiFetch.mockClear()

    document.dispatchEvent(new CustomEvent("case-score:persisted", { detail: { caseId: 99 } }))
    expect(apiFetch).not.toHaveBeenCalled()

    document.dispatchEvent(new CustomEvent("case-score:persisted", { detail: { caseId: 5 } }))
    expect(apiFetch).toHaveBeenCalledWith("/api/cases/5/scores")
  })

  it("reloads annotations only for its own case when annotations change", async () => {
    const { controller } = mount()
    controller.connect()
    await flush()
    apiFetch.mockClear()

    document.dispatchEvent(new CustomEvent("annotations:changed", { detail: { caseId: 99 } }))
    expect(apiFetch).not.toHaveBeenCalled()

    document.dispatchEvent(new CustomEvent("annotations:changed", { detail: { caseId: 5 } }))
    expect(apiFetch).toHaveBeenCalledWith("/api/cases/5/annotations")
  })

  it("stops listening and finalizes the chart on disconnect", async () => {
    const { controller } = mount()
    controller.connect()
    await flush()

    controller.disconnect()
    apiFetch.mockClear()
    document.dispatchEvent(new CustomEvent("case-score:persisted", { detail: { caseId: 5 } }))

    expect(apiFetch).not.toHaveBeenCalled()
    expect(finalize).toHaveBeenCalled()
  })
})
