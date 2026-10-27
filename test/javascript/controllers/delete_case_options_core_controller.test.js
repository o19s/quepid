import { buildControllerFixture } from "../support/controller_fixture"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import DeleteCaseOptionsCoreController from "controllers/delete_case_options_core_controller"
import { mountCaseHeader } from "../support/case_header_dom"
import { deleteJson, postJson } from "api/json"
import coreFlash from "utils/core_flash"
import { HttpError } from "api/http_error"

vi.mock("api/json", () => ({ deleteJson: vi.fn(), postJson: vi.fn() }))
vi.mock("utils/core_flash", () => ({ default: { show: vi.fn() } }))
const assign = vi.fn()

function buildOptionButton(action) {
  const btn = document.createElement("button")
  btn.dataset.deleteCaseOptionsCoreActionParam = action
  return btn
}

function buildDescription(action) {
  const el = document.createElement("div")
  el.dataset.forAction = action
  el.hidden = true
  return el
}

function buildModalController(overrides = {}) {
  const controller = buildControllerFixture(DeleteCaseOptionsCoreController, {
    element: document.createElement("div"),
    targets: {
      title: document.createElement("h5"),
      optionButton: [
        buildOptionButton("destroy_queries"),
        buildOptionButton("archive"),
        buildOptionButton("destroy_case")
      ],
      description: [
        buildDescription("destroy_queries"),
        buildDescription("archive"),
        buildDescription("destroy_case")
      ],
      submitButton: document.createElement("button")
    },
    values: {
      archiveUrlTemplate: "/cases/__CASE_ID__/archive",
      destroyUrlTemplate: "/cases/__CASE_ID__",
      destroyQueriesUrlTemplate: "/cases/__CASE_ID__/queries"
    },
    overrides: {
      identifier: "delete-case-options-core",
      hide: vi.fn()
    }
  })

  Object.assign(controller, overrides)
  return controller
}

describe("DeleteCaseOptionsCoreController", () => {
  afterEach(() => vi.unstubAllGlobals())
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("window", { location: { assign } })
    postJson.mockResolvedValue({ redirect_url: "/cases" })
    deleteJson.mockResolvedValue({ redirect_url: "/case/42/1" })
  })

  it("open titles itself from the live case header and disables the submit button until a choice is made", () => {
    const controller = buildModalController()
    mountCaseHeader("Movies")
    const trigger = document.createElement("a")
    trigger.dataset.deleteCaseOptionsCoreIdValue = "42"

    controller.openFor(trigger)

    expect(controller.currentCaseId).toBe("42")
    expect(controller.titleTarget.textContent).toBe("Delete Options for Case: Movies")
    expect(controller.submitButtonTarget.disabled).toBe(true)
  })

  it("selectAction highlights the chosen option, reveals its description, and enables the submit button with the matching label", () => {
    const controller = buildModalController()
    controller.currentCaseId = "42"
    controller.selectAction({ params: { action: "destroy_case" } })

    expect(controller.selectedAction).toBe("destroy_case")
    expect(controller.optionButtonTargets[2].classList.contains("btn-primary")).toBe(true)
    expect(controller.optionButtonTargets[0].classList.contains("btn-primary")).toBe(false)
    expect(controller.descriptionTargets[2].hidden).toBe(false)
    expect(controller.descriptionTargets[0].hidden).toBe(true)
    expect(controller.submitButtonTarget.disabled).toBe(false)
    expect(controller.submitButtonTarget.textContent).toBe("Delete")
  })

  it("confirm resolves the archive url template and posts", async () => {
    const controller = buildModalController()
    controller.currentCaseId = "42"
    controller.selectedAction = "archive"

    await controller.confirm()

    expect(postJson).toHaveBeenCalledWith("/cases/42/archive", {})
    expect(assign).toHaveBeenCalledWith("/cases")
  })

  it("confirm resolves the delete-all-queries url template with a delete method", async () => {
    const controller = buildModalController()
    controller.currentCaseId = "42"
    controller.selectedAction = "destroy_queries"

    await controller.confirm()

    expect(deleteJson).toHaveBeenCalledWith("/cases/42/queries")
    expect(assign).toHaveBeenCalledWith("/case/42/1")
  })

  it.each(["archive", "destroy_queries", "destroy_case"])(
    "navigates to sign-in after %s loses its session",
    async (action) => {
      const controller = buildModalController()
      controller.currentCaseId = "42"
      controller.selectedAction = action
      const request = action === "archive" ? postJson : deleteJson
      request.mockRejectedValueOnce(
        new HttpError({ status: 401, data: { redirect_url: "/quepid/sessions/new" } })
      )

      await controller.confirm()

      expect(assign).toHaveBeenCalledWith("/quepid/sessions/new")
      expect(coreFlash.show).not.toHaveBeenCalled()
      expect(controller.submitButtonTarget.disabled).toBe(false)
    }
  )

  it.each(["archive", "destroy_queries", "destroy_case"])(
    "keeps the workspace after a failed %s and permits retry",
    async (action) => {
      const controller = buildModalController()
      controller.currentCaseId = "42"
      controller.selectedAction = action
      const request = action === "archive" ? postJson : deleteJson
      request.mockRejectedValueOnce(
        new HttpError({ status: 500, data: { error: "Database unavailable" } })
      )

      await controller.confirm()

      expect(controller.hide).toHaveBeenCalledOnce()
      expect(coreFlash.show).toHaveBeenCalledWith("error", "Database unavailable")
      expect(assign).not.toHaveBeenCalled()
      expect(controller.submitButtonTarget.disabled).toBe(false)
      await controller.confirm()
      expect(request).toHaveBeenCalledTimes(2)
      expect(assign).toHaveBeenCalledOnce()
    }
  )

  it("shows a contextual error for an HTML 500 and blocks duplicate requests", async () => {
    const controller = buildModalController()
    controller.currentCaseId = "42"
    controller.selectedAction = "destroy_case"
    let reject
    deleteJson.mockImplementationOnce(
      () =>
        new Promise((resolve, rejectRequest) => {
          reject = rejectRequest
        })
    )
    const pending = controller.confirm()
    await controller.confirm()
    expect(deleteJson).toHaveBeenCalledOnce()
    reject(new HttpError({ status: 500 }))
    await pending
    expect(coreFlash.show).toHaveBeenCalledWith("error", "Could not delete. Please try again.")
    expect(assign).not.toHaveBeenCalled()
  })

  it("confirm does nothing when no action has been selected", async () => {
    const controller = buildModalController()
    controller.currentCaseId = "42"
    controller.selectedAction = null

    await controller.confirm()

    expect(deleteJson).not.toHaveBeenCalled()
    expect(postJson).not.toHaveBeenCalled()
  })
})
