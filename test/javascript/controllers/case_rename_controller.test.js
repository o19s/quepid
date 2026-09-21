import { beforeEach, describe, expect, it } from "vitest"
import CaseRenameController from "controllers/case_rename_controller"

/**
 * Contracts ported from the Angular header this replaced: `CaseCtrl.caseName` /
 * `caseNameEditModeToggle` and `CurrSettingsCtrl.tryName` / `tryNameEditModeToggle` in
 * app/assets/javascripts/controllers/case.js and currSettings.js (no Karma specs existed for
 * either, so these are the first automated coverage of that behaviour).
 *
 * Not covered here, because it is Turbo's job rather than the controller's: the form POST and
 * the `case_header` frame re-render. Those are exercised by the Rails controller test and by
 * the Playwright core smoke spec.
 */
function buildController({ withTry = true } = {}) {
  const element = document.createElement("div")

  const caseDisplay = document.createElement("span")
  const caseForm = document.createElement("span")
  const caseInput = document.createElement("input")
  const caseSubmit = document.createElement("input")

  caseForm.classList.add("d-none")
  caseInput.setAttribute("value", "Movies Case")
  caseInput.value = "Movies Case"
  caseSubmit.type = "submit"

  element.append(caseDisplay, caseForm, caseInput, caseSubmit)

  const controller = Object.create(CaseRenameController.prototype)
  controller.element = element
  controller.caseDisplayTarget = caseDisplay
  controller.caseFormTarget = caseForm
  controller.caseInputTarget = caseInput
  controller.caseSubmitTarget = caseSubmit
  controller.hasCaseDisplayTarget = true
  controller.hasCaseFormTarget = true
  controller.hasCaseInputTarget = true
  controller.hasCaseSubmitTarget = true

  if (withTry) {
    const tryDisplay = document.createElement("span")
    const tryForm = document.createElement("span")
    const tryInput = document.createElement("input")
    const trySubmit = document.createElement("input")

    tryForm.classList.add("d-none")
    tryInput.setAttribute("value", "Try 4")
    tryInput.value = "Try 4"
    trySubmit.type = "submit"

    element.append(tryDisplay, tryForm, tryInput, trySubmit)

    controller.tryDisplayTarget = tryDisplay
    controller.tryFormTarget = tryForm
    controller.tryInputTarget = tryInput
    controller.trySubmitTarget = trySubmit
    controller.hasTryDisplayTarget = true
    controller.hasTryFormTarget = true
    controller.hasTryInputTarget = true
    controller.hasTrySubmitTarget = true
  } else {
    controller.hasTryDisplayTarget = false
    controller.hasTryFormTarget = false
    controller.hasTryInputTarget = false
    controller.hasTrySubmitTarget = false
  }

  document.body.appendChild(element)
  return controller
}

describe("CaseRenameController", () => {
  let controller

  beforeEach(() => {
    document.body.innerHTML = ""
    controller = buildController()
  })

  it("shows the case form and hides the display when editing starts", () => {
    CaseRenameController.prototype.editCase.call(controller)

    expect(controller.caseFormTarget.classList.contains("d-none")).toBe(false)
    expect(controller.caseDisplayTarget.classList.contains("d-none")).toBe(true)
  })

  // Angular's caseNameEditModeToggle was a toggle, not a one-way open.
  it("closes the case editor again on a second edit", () => {
    CaseRenameController.prototype.editCase.call(controller)
    CaseRenameController.prototype.editCase.call(controller)

    expect(controller.caseFormTarget.classList.contains("d-none")).toBe(true)
    expect(controller.caseDisplayTarget.classList.contains("d-none")).toBe(false)
  })

  it("restores the persisted case name and hides the form on cancel", () => {
    CaseRenameController.prototype.editCase.call(controller)
    controller.caseInputTarget.value = "abandoned edit"

    CaseRenameController.prototype.cancelCase.call(controller)

    expect(controller.caseInputTarget.value).toBe("Movies Case")
    expect(controller.caseFormTarget.classList.contains("d-none")).toBe(true)
  })

  // Ports ng-disabled="!caseName.name || !caseName.name.trim()".
  it("disables the case submit for a blank or whitespace-only name", () => {
    controller.caseInputTarget.value = "   "
    CaseRenameController.prototype.caseInputChanged.call(controller)
    expect(controller.caseSubmitTarget.disabled).toBe(true)

    controller.caseInputTarget.value = ""
    CaseRenameController.prototype.caseInputChanged.call(controller)
    expect(controller.caseSubmitTarget.disabled).toBe(true)

    controller.caseInputTarget.value = "Renamed"
    CaseRenameController.prototype.caseInputChanged.call(controller)
    expect(controller.caseSubmitTarget.disabled).toBe(false)
  })

  it("disables the try submit for a blank try name", () => {
    controller.tryInputTarget.value = "  "
    CaseRenameController.prototype.tryInputChanged.call(controller)
    expect(controller.trySubmitTarget.disabled).toBe(true)
  })

  it("toggles the try editor independently of the case editor", () => {
    CaseRenameController.prototype.editTry.call(controller)

    expect(controller.tryFormTarget.classList.contains("d-none")).toBe(false)
    expect(controller.caseFormTarget.classList.contains("d-none")).toBe(true)
  })

  it("syncs both submit buttons on connect", () => {
    controller.caseInputTarget.value = ""
    controller.tryInputTarget.value = ""

    CaseRenameController.prototype.connect.call(controller)

    expect(controller.caseSubmitTarget.disabled).toBe(true)
    expect(controller.trySubmitTarget.disabled).toBe(true)
  })

  // A case whose try could not be resolved renders the header without try form targets.
  it("does nothing on editTry when the try targets are absent", () => {
    const withoutTry = buildController({ withTry: false })

    expect(() => CaseRenameController.prototype.editTry.call(withoutTry)).not.toThrow()
    expect(() => CaseRenameController.prototype.connect.call(withoutTry)).not.toThrow()
  })
})
