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
  const controller = Object.create(MoveQueryCoreController.prototype)
  controller.element = document.createElement("div")
  controller.application = {
    getControllerForElementAndIdentifier: vi.fn(() => null)
  }
  controller.casesUrlValue = "/api/cases"
  controller.hasCasesUrlValue = true
  controller.hasTitleTarget = true
  controller.titleTarget = document.createElement("h5")
  controller.hasLoadingTarget = true
  controller.loadingTarget = document.createElement("div")
  controller.hasEmptyTarget = true
  controller.emptyTarget = document.createElement("div")
  controller.hasCaseListTarget = true
  controller.caseListTarget = document.createElement("div")
  controller.hasSubmitButtonTarget = true
  controller.submitButtonTarget = document.createElement("button")
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
      ok: true,
      json: () => Promise.resolve({
        all_cases: [
          { case_id: 4, case_name: "Current" },
          { case_id: 8, case_name: "Other Case" }
        ]
      })
    })
    window.quepidDom = { flash: { show: vi.fn() } }
    window.quepidSearch = { queryLifecycle: { moveQuery: vi.fn().mockResolvedValue({}) } }
  })

  afterEach(() => {
    delete window.quepidDom
    delete window.quepidSearch
    vi.restoreAllMocks()
  })

  it("loads and filters the current case while preserving the list-group UI", async () => {
    const controller = buildController()

    await controller.open({ preventDefault: vi.fn(), currentTarget: trigger() })

    expect(controller.queryId).toBe("12")
    expect(controller.currentCaseId).toBe("4")
    expect(controller.caseListTarget.textContent).toContain("Other Case")
    expect(controller.caseListTarget.textContent).not.toContain("Current")
    expect(controller.submitButtonTarget.disabled).toBe(true)
  })

  it("selects a case and moves the query through the temporary Angular adapter", async () => {
    const controller = buildController()
    await controller.open({ preventDefault: vi.fn(), currentTarget: trigger() })

    const caseButton = controller.caseListTarget.querySelector("button")
    controller.selectCase({ currentTarget: caseButton })
    expect(controller.submitButtonTarget.textContent).toBe("Move to Other Case")
    expect(controller.submitButtonTarget.disabled).toBe(false)

    await controller.submit({ preventDefault: vi.fn() })

    expect(window.quepidSearch.queryLifecycle.moveQuery).toHaveBeenCalledWith("12", 8)
    expect(window.quepidDom.flash.show).toHaveBeenCalledWith("success", "Query moved successfully!")
  })

  it("reports an unavailable adapter without submitting", async () => {
    delete window.quepidSearch.queryLifecycle.moveQuery
    const controller = buildController()
    controller.queryId = "12"
    controller.selectedCase = { case_id: 8, case_name: "Other Case" }

    await controller.submit({ preventDefault: vi.fn() })

    expect(window.quepidDom.flash.show).toHaveBeenCalledWith("error", "Unable to move query.")
  })
})
