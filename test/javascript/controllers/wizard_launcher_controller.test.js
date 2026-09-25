import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import WizardLauncherController from "controllers/wizard_launcher_controller"

function buildController({ auto = false } = {}) {
  const element = document.createElement("div")
  const controller = Object.create(WizardLauncherController.prototype)
  controller.element = element
  controller.autoValue = auto
  document.body.appendChild(element)
  return controller
}

describe("WizardLauncherController", () => {
  let modal

  beforeEach(() => {
    document.body.innerHTML = ""
    const wizardModal = document.createElement("div")
    wizardModal.id = "wizardModal"
    document.body.appendChild(wizardModal)
    modal = document.createElement("div")
    modal.id = "wizardModal"
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("creates a case and opens the existing wizard from the header", () => {
    const controller = buildController()
    controller.createUrlValue = "cases/new"
    const event = { preventDefault: vi.fn() }
    const navigation = vi.spyOn(window.location, "assign").mockImplementation(() => {})

    controller.newCase(event)

    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(navigation).toHaveBeenCalledWith("cases/new")
  })

  it("auto-opens for the explicit wizard deep link", () => {
    window.history.pushState({}, "", "/case/6/try/1?showWizard=true")
    const controller = buildController({ auto: true })
    controller.completedCaseWizardValue = true
    controller.casesInvolvedWithCountValue = 2
    controller.teamsInvolvedWithCountValue = 0

    controller.openAutomatically()

    expect(document.getElementById("wizardModal")).not.toBeNull()
  })

  it("auto-opens for a first-case user", () => {
    window.history.pushState({}, "", "/case/6/try/1")
    const controller = buildController({ auto: true })
    controller.completedCaseWizardValue = false
    controller.casesInvolvedWithCountValue = 1
    controller.teamsInvolvedWithCountValue = 0

    controller.openAutomatically()

    expect(document.getElementById("wizardModal")).not.toBeNull()
  })

})
