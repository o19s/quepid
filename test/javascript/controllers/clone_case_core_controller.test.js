import { buildControllerFixture } from "../support/controller_fixture"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { apiFetch } from "api/fetch"
import CloneCaseCoreController from "controllers/clone_case_core_controller"
import { mountCaseHeader } from "../support/case_header_dom"

vi.mock("api/fetch", () => ({
  apiFetch: vi.fn()
}))

function buildModalController(overrides = {}) {
  const controller = buildControllerFixture(CloneCaseCoreController, {
    targets: {
      title: document.createElement("h5"),
      alert: document.createElement("div"),
      noQueriesAlert: document.createElement("div"),
      caseNameInput: document.createElement("input"),
      historyOffButton: document.createElement("button"),
      historyOnButton: document.createElement("button"),
      tryFieldWrapper: document.createElement("div"),
      trySelect: document.createElement("select"),
      queriesCheckbox: document.createElement("input"),
      ratingsCheckbox: document.createElement("input"),
      submitButton: document.createElement("button")
    },
    values: {
      triesUrlTemplate: "/api/cases/__CASE_ID__/tries",
      cloneUrl: "/api/clone/cases"
    }
  })

  Object.assign(controller, overrides)
  return controller
}

function buildTrigger({ id = "5", name = "Movies", lastTry = "3" } = {}) {
  mountCaseHeader(name)
  const trigger = document.createElement("a")
  trigger.dataset.cloneCaseCoreIdValue = id
  trigger.dataset.cloneCaseCoreLastTryValue = lastTry
  return trigger
}

describe("CloneCaseCoreController", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiFetch.mockResolvedValue({
      async text() {
        return JSON.stringify(await this.json()) || ""
      },
      ok: true,
      json: () => Promise.resolve({ tries: [] })
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("open resets state from the trigger's dataset and disables submit until a case name is entered", async () => {
    const controller = buildModalController()
    const trigger = buildTrigger()

    await controller.openFor(trigger)

    expect(controller.currentCaseId).toBe("5")
    expect(controller.titleTarget.textContent).toBe("Clone case: Movies")
    expect(controller.tryNumber).toBe(3)
    expect(controller.includeQueries).toBe(true)
    expect(controller.includeRatings).toBe(false)
    expect(controller.submitButtonTarget.disabled).toBe(true)
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/cases/5/tries",
      expect.objectContaining({ headers: { Accept: "application/json" } })
    )
  })

  it("loadTries populates the try select and preselects the current try number", async () => {
    apiFetch.mockResolvedValue({
      async text() {
        return JSON.stringify(await this.json()) || ""
      },
      ok: true,
      json: () =>
        Promise.resolve({
          tries: [
            { try_number: 1, name: "Try 1" },
            { try_number: 3, name: "Try 3" }
          ]
        })
    })
    const controller = buildModalController()
    controller.currentCaseId = "5"
    controller.tryNumber = 3

    await controller.loadTries()

    expect(controller.trySelectTarget.children).toHaveLength(2)
    expect(controller.trySelectTarget.value).toBe("3")
  })

  it("selectHistory toggles button styling and hides the try picker when including full history", () => {
    const controller = buildModalController()

    controller.selectHistory({ params: { history: true } })

    expect(controller.history).toBe(true)
    expect(controller.historyOnButtonTarget.classList.contains("btn-primary")).toBe(true)
    expect(controller.historyOffButtonTarget.classList.contains("btn-primary")).toBe(false)
    expect(controller.tryFieldWrapperTarget.classList.contains("d-none")).toBe(true)
  })

  it("toggleQueries shows the empty-case warning when queries are excluded", () => {
    const controller = buildModalController()

    controller.toggleQueries({ target: { checked: false } })

    expect(controller.includeQueries).toBe(false)
    expect(controller.noQueriesAlertTarget.classList.contains("d-none")).toBe(false)
  })

  it("updateCaseName enables the submit button once a name is present", () => {
    const controller = buildModalController()
    controller.newCaseName = ""

    controller.updateCaseName({ target: { value: "Cloned case" } })

    expect(controller.newCaseName).toBe("Cloned case")
    expect(controller.submitButtonTarget.disabled).toBe(false)
  })

  it("submit posts the clone options and redirects to the new case on success", async () => {
    vi.useFakeTimers()
    document.body.dataset.quepidRootUrl = "https://example.com/quepid"
    const originalLocation = window.location
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "http://localhost/case/5" }
    })

    apiFetch.mockResolvedValue({
      async text() {
        return JSON.stringify(await this.json()) || ""
      },
      ok: true,
      json: () => Promise.resolve({ case_id: 42, last_try_number: 1 })
    })

    const controller = buildModalController()
    controller.currentCaseId = "5"
    controller.newCaseName = "Cloned case"
    controller.includeQueries = true
    controller.includeRatings = false
    controller.history = false
    controller.tryNumber = 3

    await controller.submit({ preventDefault: () => {} })
    await vi.runAllTimersAsync()

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/clone/cases",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          case_id: 5,
          clone_queries: true,
          clone_ratings: false,
          preserve_history: false,
          try_number: 3,
          case_name: "Cloned case"
        })
      })
    )
    expect(window.location.href).toBe("https://example.com/quepid/case/42/try/1")

    vi.useRealTimers()
    delete document.body.dataset.quepidRootUrl
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation })
  })

  it("submit shows an inline alert and re-enables submit on failure", async () => {
    apiFetch.mockResolvedValue({
      async text() {
        return JSON.stringify(await this.json()) || ""
      },
      ok: false,
      json: () => Promise.resolve({ error: "Nope" })
    })

    const controller = buildModalController()
    controller.currentCaseId = "5"
    controller.newCaseName = "Cloned case"

    await controller.submit({ preventDefault: () => {} })

    expect(controller.alertTarget.textContent).toBe("Nope")
    expect(controller.submitButtonTarget.disabled).toBe(false)
  })

  it("submit does nothing without a case name", async () => {
    const controller = buildModalController()
    controller.currentCaseId = "5"
    controller.newCaseName = ""

    await controller.submit({ preventDefault: () => {} })

    expect(apiFetch).not.toHaveBeenCalled()
  })
})
