import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { submitDestructiveForm } from "utils/destructive_form"
import DeleteCaseOptionsCoreController from "controllers/delete_case_options_core_controller"
import { mountCaseHeader } from "../support/case_header_dom"

vi.mock("utils/destructive_form", () => ({
  submitDestructiveForm: vi.fn()
}))

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
  const controller = Object.create(DeleteCaseOptionsCoreController.prototype)
  controller.identifier = "delete-case-options-core"
  controller.element = document.createElement("div")
  controller.archiveUrlTemplateValue = "/cases/__CASE_ID__/archive"
  controller.destroyUrlTemplateValue = "/cases/__CASE_ID__"
  controller.destroyQueriesUrlTemplateValue = "/cases/__CASE_ID__/queries"
  controller.hasTitleTarget = true
  controller.titleTarget = document.createElement("h5")
  controller.optionButtonTargets = [
    buildOptionButton("destroy_queries"),
    buildOptionButton("archive"),
    buildOptionButton("destroy_case")
  ]
  controller.descriptionTargets = [
    buildDescription("destroy_queries"),
    buildDescription("archive"),
    buildDescription("destroy_case")
  ]
  controller.hasSubmitButtonTarget = true
  controller.submitButtonTarget = document.createElement("button")

  Object.assign(controller, overrides)
  return controller
}

describe("DeleteCaseOptionsCoreController", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
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

  it("confirm resolves the archive url template and posts", () => {
    const controller = buildModalController()
    controller.currentCaseId = "42"
    controller.selectedAction = "archive"

    controller.confirm()

    expect(submitDestructiveForm).toHaveBeenCalledWith("/cases/42/archive", "post")
  })

  it("confirm resolves the delete-all-queries url template with a delete method", () => {
    const controller = buildModalController()
    controller.currentCaseId = "42"
    controller.selectedAction = "destroy_queries"

    controller.confirm()

    expect(submitDestructiveForm).toHaveBeenCalledWith("/cases/42/queries", "delete")
  })

  it("confirm does nothing when no action has been selected", () => {
    const controller = buildModalController()
    controller.currentCaseId = "42"
    controller.selectedAction = null

    controller.confirm()

    expect(submitDestructiveForm).not.toHaveBeenCalled()
  })
})
