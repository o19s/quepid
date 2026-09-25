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
  let injector
  let modal
  let modalService
  let caseSvc
  let rootScope

  beforeEach(() => {
    document.body.innerHTML = ""
    modal = { result: { then: vi.fn() } }
    modalService = { open: vi.fn(() => modal) }
    caseSvc = { createCase: vi.fn() }
    rootScope = { currentUser: { completedCaseWizard: true } }
    injector = {
      get: vi.fn((name) => ({
        $rootScope: rootScope,
        $quepidModal: modalService,
        caseSvc
      }[name]))
    }
    window.angular = { element: vi.fn(() => ({ injector: () => injector })) }
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete window.angular
  })

  it("creates a case and opens the existing wizard from the header", () => {
    const controller = buildController()
    const event = { preventDefault: vi.fn() }

    controller.newCase(event)

    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(caseSvc.createCase).toHaveBeenCalledOnce()
    expect(modalService.open).toHaveBeenCalledWith({
      templateUrl: "views/wizardModal.html",
      controller: "WizardModalCtrl",
      backdrop: "static",
      windowClass: "wizard-modal-window"
    })
  })

  it("auto-opens for the explicit wizard deep link", () => {
    window.history.pushState({}, "", "/case/6/try/1?showWizard=true")
    rootScope.currentUser = { completedCaseWizard: true }
    const controller = buildController({ auto: true })

    controller.openAutomatically()

    expect(modalService.open).toHaveBeenCalledOnce()
    expect(caseSvc.createCase).not.toHaveBeenCalled()
  })

  it("auto-opens for a first-case user", () => {
    window.history.pushState({}, "", "/case/6/try/1")
    rootScope.currentUser = {
      completedCaseWizard: false,
      casesInvolvedWithCount: 1,
      teamsInvolvedWithCount: 0,
      introWizardSeen: false
    }
    const controller = buildController({ auto: true })

    controller.openAutomatically()

    expect(modalService.open).toHaveBeenCalledOnce()
  })

  it("waits for the Angular bootstrap user before auto-opening", () => {
    vi.useFakeTimers()
    rootScope.currentUser = null
    const controller = buildController({ auto: true })

    controller.openAutomatically()
    vi.advanceTimersByTime(100)

    expect(modalService.open).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
