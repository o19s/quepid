import { buildControllerFixture } from "../support/controller_fixture"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { apiFetch } from "api/fetch"
import MoveQueryCoreController from "controllers/move_query_core_controller"

vi.mock("api/fetch", () => ({
  apiFetch: vi.fn()
}))

vi.mock("utils/bs_modal", () => ({
  getOrCreateBsModal: vi.fn(() => ({ hide: vi.fn() }))
}))

function buildController(overrides = {}) {
  const controller = buildControllerFixture(MoveQueryCoreController, {
    targets: {
      title: document.createElement("h5"),
      loading: document.createElement("div"),
      empty: document.createElement("div"),
      caseList: document.createElement("div"),
      caseListLabel: document.createElement("p"),
      submitButton: document.createElement("button")
    },
    values: {
      casesUrl: "/api/cases"
    }
  })
  controller.cases = []
  Object.assign(controller, overrides)
  return controller
}

function trigger({ queryId = "12", caseId = "4" } = {}) {
  const button = document.createElement("button")
  button.dataset.moveQueryCoreQueryIdValue = queryId
  button.dataset.moveQueryCoreCaseIdValue = caseId
  return button
}

describe("MoveQueryCoreController", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiFetch.mockResolvedValue({
      async text() {
        return JSON.stringify(await this.json()) || ""
      },
      ok: true,
      json: () => Promise.resolve({
        all_cases: [
          { case_id: 4, case_name: "Current" },
          { case_id: 8, case_name: "Other Case" }
        ]
      })
    })
    window.quepidDom = { flash: { show: vi.fn() } }
  })

  afterEach(() => {
    delete window.quepidDom
    delete window.quepidSearch
    vi.restoreAllMocks()
  })

  it("loads and filters the current case while preserving the list-group UI", async () => {
    const controller = buildController()

    await controller.openFor(trigger())

    expect(controller.queryId).toBe("12")
    expect(controller.currentCaseId).toBe("4")
    expect(controller.caseListTarget.textContent).toContain("Other Case")
    expect(controller.caseListTarget.textContent).not.toContain("Current")
    expect(controller.caseListLabelTarget.classList.contains("d-none")).toBe(false)
    expect(controller.submitButtonTarget.disabled).toBe(true)
    expect(controller.submitButtonTarget.hidden).toBe(true)
  })

  it("selects a case and moves the query through the API command seam", async () => {
    const controller = buildController()
    await controller.openFor(trigger())

    const caseButton = controller.caseListTarget.querySelector("button")
    expect(caseButton.dataset.moveQueryCoreCaseIdParam).toBe("8")
    controller.selectCase({ params: { caseId: 8 } })
    expect(controller.submitButtonTarget.textContent).toBe("Move to Other Case")
    expect(controller.submitButtonTarget.disabled).toBe(false)
    expect(controller.submitButtonTarget.hidden).toBe(false)

    await controller.submit({ preventDefault: vi.fn() })

    expect(apiFetch).toHaveBeenCalledWith("api/cases/4/queries/12", expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({ other_case_id: 8 })
    }))
    expect(window.quepidDom.flash.show).toHaveBeenCalledWith("success", "Query moved successfully!")
  })

  it("reports missing query identity without submitting", async () => {
    const controller = buildController()
    controller.queryId = "12"
    controller.currentCaseId = ""
    controller.selectedCase = { case_id: 8, case_name: "Other Case" }

    await controller.submit({ preventDefault: vi.fn() })

    expect(window.quepidDom.flash.show).toHaveBeenCalledWith("error", "Unable to move query.")
  })
})
