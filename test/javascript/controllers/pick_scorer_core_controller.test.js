import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { apiFetch } from "api/fetch"
import PickScorerCoreController from "controllers/pick_scorer_core_controller"

vi.mock("api/fetch", () => ({
  apiFetch: vi.fn()
}))

vi.mock("utils/bs_modal", () => ({
  getOrCreateBsModal: vi.fn(() => ({ hide: vi.fn(), show: vi.fn() })),
  hideBsModal: vi.fn()
}))

function buildModalController(overrides = {}) {
  const controller = Object.create(PickScorerCoreController.prototype)
  controller.application = {
    getControllerForElementAndIdentifier: vi.fn(() => null)
  }
  controller.scorersUrlValue = "/api/scorers"
  controller.caseScorerUrlTemplateValue = "/api/cases/__CASE_ID__/scorers/__SCORER_ID__"
  controller.communalScorersOnlyValue = false
  controller.hasCommunalScorersOnlyValue = true

  controller.hasTitleTarget = true
  controller.titleTarget = document.createElement("h5")
  controller.hasAlertTarget = true
  controller.alertTarget = document.createElement("div")
  controller.hasWarningTarget = true
  controller.warningTarget = document.createElement("div")
  controller.hasWarningNameTarget = true
  controller.warningNameTarget = document.createElement("span")
  controller.hasCommunalListTarget = true
  controller.communalListTarget = document.createElement("ul")
  controller.hasCustomSectionTarget = true
  controller.customSectionTarget = document.createElement("div")
  controller.hasCustomListTarget = true
  controller.customListTarget = document.createElement("ul")
  controller.hasCustomEmptyTarget = true
  controller.customEmptyTarget = document.createElement("p")
  controller.hasCreateButtonTarget = true
  controller.createButtonTarget = document.createElement("button")
  controller.hasSubmitButtonTarget = true
  controller.submitButtonTarget = document.createElement("button")
  controller.element = document.createElement("div")
  controller.element.appendChild(controller.communalListTarget)
  controller.element.appendChild(controller.customListTarget)

  Object.assign(controller, overrides)
  return controller
}

describe("PickScorerCoreController", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("loads communal and custom scorers and selects the current one", async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          communal_scorers: [{ scorer_id: 1, name: "AP@10" }],
          user_scorers: [{ scorer_id: 9, name: "Custom" }]
        })
    })

    const controller = buildModalController()
    const trigger = document.createElement("a")
    trigger.dataset.pickScorerCoreIdValue = "5"
    trigger.dataset.pickScorerCoreCurrentScorerIdValue = "9"

    await controller.openAsRoot({ currentTarget: trigger, preventDefault() {} })

    expect(apiFetch).toHaveBeenCalledWith("/api/scorers", expect.any(Object))
    expect(controller.selectedScorer.scorer_id).toBe(9)
    expect(controller.communalListTarget.children).toHaveLength(1)
    expect(controller.customListTarget.children).toHaveLength(1)
    expect(controller.customSectionTarget.classList.contains("d-none")).toBe(false)
  })

  it("shows the inaccessible-scorer warning when the case scorer is not in the lists", async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          communal_scorers: [{ scorer_id: 1, name: "AP@10" }],
          user_scorers: []
        })
    })

    const controller = buildModalController()
    const trigger = document.createElement("a")
    trigger.dataset.pickScorerCoreIdValue = "5"
    trigger.dataset.pickScorerCoreCurrentScorerIdValue = "99"
    trigger.dataset.pickScorerCoreCurrentScorerNameValue = "Secret Team Scorer"

    await controller.openAsRoot({ currentTarget: trigger, preventDefault() {} })

    expect(controller.selectedScorer.scorer_id).toBe(99)
    expect(controller.warningTarget.classList.contains("d-none")).toBe(false)
    expect(controller.warningNameTarget.textContent).toBe("Secret Team Scorer")
  })

  it("hides the custom scorer list when communalScorersOnly is set", async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          communal_scorers: [{ scorer_id: 1, name: "AP@10" }],
          user_scorers: [{ scorer_id: 9, name: "Custom" }]
        })
    })

    const controller = buildModalController({ communalScorersOnlyValue: true })
    const trigger = document.createElement("a")
    trigger.dataset.pickScorerCoreIdValue = "5"
    trigger.dataset.pickScorerCoreCurrentScorerIdValue = "1"

    await controller.openAsRoot({ currentTarget: trigger, preventDefault() {} })

    expect(controller.customSectionTarget.classList.contains("d-none")).toBe(true)
    expect(controller.customListTarget.classList.contains("d-none")).toBe(true)
    expect(controller.customListTarget.children).toHaveLength(0)
    expect(controller.createButtonTarget.classList.contains("d-none")).toBe(true)
  })

  it("ignores a non-numeric current scorer id like Angular's default", async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          communal_scorers: [{ scorer_id: 1, name: "AP@10" }],
          user_scorers: []
        })
    })

    const controller = buildModalController()
    const trigger = document.createElement("a")
    trigger.dataset.pickScorerCoreIdValue = "5"
    trigger.dataset.pickScorerCoreCurrentScorerIdValue = "default"

    await controller.openAsRoot({ currentTarget: trigger, preventDefault() {} })

    expect(controller.initialScorerId).toBeNull()
    expect(controller.selectedScorer).toBeNull()
    expect(controller.warningTarget.classList.contains("d-none")).toBe(true)
  })

  it("disables submit for an inaccessible scorer and refuses to submit it", async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          communal_scorers: [{ scorer_id: 1, name: "AP@10" }],
          user_scorers: []
        })
    })

    const controller = buildModalController()
    const trigger = document.createElement("a")
    trigger.dataset.pickScorerCoreIdValue = "5"
    trigger.dataset.pickScorerCoreCurrentScorerIdValue = "99"
    trigger.dataset.pickScorerCoreCurrentScorerNameValue = "Secret Team Scorer"

    await controller.openAsRoot({ currentTarget: trigger, preventDefault() {} })

    expect(controller.selectedScorer.inaccessible).toBe(true)
    expect(controller.submitButtonTarget.disabled).toBe(true)

    await controller.submit({ preventDefault() {} })

    // Only the initial scorer-list load, no PUT save attempt.
    expect(apiFetch).toHaveBeenCalledTimes(1)
  })

  it("re-enables submit once a real scorer replaces an inaccessible selection", async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          communal_scorers: [{ scorer_id: 1, name: "AP@10" }],
          user_scorers: []
        })
    })

    const controller = buildModalController()
    const trigger = document.createElement("a")
    trigger.dataset.pickScorerCoreIdValue = "5"
    trigger.dataset.pickScorerCoreCurrentScorerIdValue = "99"
    await controller.openAsRoot({ currentTarget: trigger, preventDefault() {} })

    expect(controller.submitButtonTarget.disabled).toBe(true)

    controller.selectScorer({ params: { scorerId: 1 } })

    expect(controller.selectedScorer.scorer_id).toBe(1)
    expect(controller.submitButtonTarget.disabled).toBe(false)
  })

  it("selectScorer does not re-enable submit while a save is still in flight", async () => {
    let resolvePut
    apiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            communal_scorers: [
              { scorer_id: 1, name: "AP@10" },
              { scorer_id: 2, name: "NDCG" }
            ],
            user_scorers: []
          })
      })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePut = resolve
          })
      )

    const controller = buildModalController()
    const trigger = document.createElement("a")
    trigger.dataset.pickScorerCoreIdValue = "5"
    trigger.dataset.pickScorerCoreCurrentScorerIdValue = "1"
    await controller.openAsRoot({ currentTarget: trigger, preventDefault() {} })

    const submitPromise = controller.submit({ preventDefault() {} })
    expect(controller.submitButtonTarget.disabled).toBe(true)

    // Clicking a different scorer while the PUT above is still pending must
    // not clobber the in-flight "submitting" state and re-enable the button.
    controller.selectScorer({ params: { scorerId: 2 } })
    expect(controller.submitButtonTarget.disabled).toBe(true)

    resolvePut({ ok: true, json: () => Promise.resolve({}) })
    await submitPromise
  })

  it("dispatches pick-scorer:selected after a successful save", async () => {
    apiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            communal_scorers: [{ scorer_id: 1, name: "AP@10" }],
            user_scorers: []
          })
      })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })

    const controller = buildModalController()
    const trigger = document.createElement("a")
    trigger.dataset.pickScorerCoreIdValue = "5"
    trigger.dataset.pickScorerCoreCurrentScorerIdValue = "1"
    await controller.openAsRoot({ currentTarget: trigger, preventDefault() {} })

    const events = []
    document.addEventListener("pick-scorer:selected", (e) => events.push(e))

    await controller.submit({ preventDefault() {} })

    expect(apiFetch).toHaveBeenLastCalledWith(
      "/api/cases/5/scorers/1",
      expect.objectContaining({ method: "PUT" })
    )
    expect(events).toHaveLength(1)
    expect(events[0].detail.caseId).toBe(5)
    expect(events[0].detail.scorer.scorer_id).toBe(1)
  })
})
