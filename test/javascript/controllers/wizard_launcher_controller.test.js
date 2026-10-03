import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import WizardLauncherController from "controllers/wizard_launcher_controller"
import { buildControllerFixture } from "../support/controller_fixture"

describe("WizardLauncherController", () => {
  let wizard

  function buildController({ auto = false, withWizard = true } = {}) {
    return buildControllerFixture(WizardLauncherController, {
      values: { auto },
      outlets: { wizard: withWizard ? wizard : null }
    })
  }

  beforeEach(() => {
    wizard = { open: vi.fn() }
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

  function openedOn(controller) {
    controller.openAutomatically()
    return wizard.open.mock.calls.length > 0
  }

  function userWith({ completed = false, cases = 1, teams = 0 } = {}) {
    const controller = buildController({ auto: true })
    controller.completedCaseWizardValue = completed
    controller.casesInvolvedWithCountValue = cases
    controller.teamsInvolvedWithCountValue = teams
    return controller
  }

  it("auto-opens for the explicit wizard deep link, whatever the user's history", () => {
    window.history.pushState({}, "", "/case/6/try/1?showWizard=true")

    expect(openedOn(userWith({ completed: true, cases: 2, teams: 3 }))).toBe(true)
  })

  it("auto-opens for a first-case user who hasn't finished the wizard and has no teams", () => {
    window.history.pushState({}, "", "/case/6/try/1")

    expect(openedOn(userWith())).toBe(true)
  })

  it.each([
    ["has already completed the wizard", { completed: true }],
    ["has more than one case", { cases: 2 }],
    ["belongs to a team", { teams: 1 }]
  ])("does not auto-open when the user %s", (_label, history) => {
    window.history.pushState({}, "", "/case/6/try/1?showWizard=false")

    expect(openedOn(userWith(history))).toBe(false)
  })

  it("does nothing when the page has no wizard modal", () => {
    window.history.pushState({}, "", "/case/6/try/1")
    const controller = buildController({ auto: true, withWizard: false })
    controller.casesInvolvedWithCountValue = 1
    controller.teamsInvolvedWithCountValue = 0

    expect(() => controller.openAutomatically()).not.toThrow()
    expect(wizard.open).not.toHaveBeenCalled()
  })

  it("falls back to the default new-case path when no create URL is configured", () => {
    const navigation = vi.spyOn(window.location, "assign").mockImplementation(() => {})

    buildController().newCase({ preventDefault: vi.fn() })

    expect(navigation).toHaveBeenCalledWith("cases/new")
  })

  it("schedules the automatic open on connect only when auto is on, and cancels it on disconnect", () => {
    vi.useFakeTimers()
    try {
      const manual = buildController({ auto: false })
      const openAutomatically = vi.spyOn(WizardLauncherController.prototype, "openAutomatically").mockImplementation(() => {})
      manual.connect()
      vi.runAllTimers()
      expect(openAutomatically).not.toHaveBeenCalled()

      const cancelled = buildController({ auto: true })
      cancelled.connect()
      cancelled.disconnect()
      vi.runAllTimers()
      expect(openAutomatically).not.toHaveBeenCalled()

      const auto = buildController({ auto: true })
      auto.connect()
      vi.runAllTimers()
      expect(openAutomatically).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
  })
})
