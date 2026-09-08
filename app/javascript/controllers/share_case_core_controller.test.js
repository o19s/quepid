import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { apiFetch } from "api/fetch"
import ShareCaseCoreController from "./share_case_core_controller"

vi.mock("api/fetch", () => ({
  apiFetch: vi.fn()
}))

function buildController(overrides = {}) {
  const controller = Object.create(ShareCaseCoreController.prototype)
  controller.element = document.createElement("div")
  controller.application = {
    getControllerForElementAndIdentifier: vi.fn(() => null)
  }
  controller.teamsUrlValue = "/api/teams"
  controller.hasTeamsUrlValue = true
  controller.teamCasesUrlTemplateValue = "/api/teams/__TEAM_ID__/cases"
  controller.teamCaseUrlTemplateValue = "/api/teams/__TEAM_ID__/cases/__CASE_ID__"
  controller.selectedShareTeamId = null
  controller.selectedShareTeamName = null
  controller.selectedSharedTeamId = null
  controller.selectedSharedTeamName = null
  controller.currentCaseId = null
  controller.allTeams = []
  controller.sharedTeams = []
  controller.hasTitleTarget = true
  controller.titleTarget = document.createElement("h5")
  controller.hasCaseIdTarget = true
  controller.caseIdTarget = { value: "" }
  controller.hasUnshareCaseIdTarget = true
  controller.unshareCaseIdTarget = { value: "" }
  controller.hasTeamIdTarget = true
  controller.teamIdTarget = { value: "" }
  controller.hasUnshareTeamIdTarget = true
  controller.unshareTeamIdTarget = { value: "" }
  controller.hasSharedListTarget = true
  controller.sharedListTarget = document.createElement("div")
  controller.hasSubmitButtonTarget = true
  controller.submitButtonTarget = document.createElement("button")
  controller.submitButtonTarget.classList.add("d-none")
  controller.hasUnshareButtonTarget = true
  controller.unshareButtonTarget = document.createElement("button")
  controller.unshareButtonTarget.classList.add("d-none")
  controller.hasAlertTarget = true
  controller.alertTarget = document.createElement("div")
  controller.hasLoadingTarget = true
  controller.loadingTarget = document.createElement("div")
  controller.hasBodyContentTarget = true
  controller.bodyContentTarget = document.createElement("div")
  controller.hasEmptyShareableTarget = true
  controller.emptyShareableTarget = document.createElement("div")
  controller.emptyShareableTarget.classList.add("d-none")
  controller.hasSharePickerTarget = true
  controller.sharePickerTarget = document.createElement("div")
  controller.hasShareableListTarget = true
  controller.shareableListTarget = document.createElement("div")
  controller.hasSharedSectionTarget = true
  controller.sharedSectionTarget = document.createElement("div")
  controller.sharedSectionTarget.classList.add("d-none")

  Object.assign(controller, overrides)
  return controller
}

const TEAM_PAYLOAD = {
  teams: [
    {
      id: 1,
      name: "OSC",
      cases: [{ case_id: 5, case_name: "Demo Case" }],
      members: []
    },
    {
      id: 2,
      name: "Other",
      cases: [{ case_id: 9, case_name: "Elsewhere" }],
      members: []
    }
  ]
}

describe("ShareCaseCoreController — modal list UI", () => {
  // List partition / selection: Angular ShareCaseModalInstanceCtrl (no Karma spec existed).
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("partitions teams into shareable vs already shared for the case", async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(TEAM_PAYLOAD)
    })

    const controller = buildController()
    await ShareCaseCoreController.prototype.open.call(controller, {
      currentTarget: {
        dataset: {
          shareCaseCoreIdValue: "5",
          shareCaseCoreNameValue: "Demo Case"
        }
      }
    })

    expect(controller.loadingTarget.classList.contains("d-none")).toBe(true)
    expect(controller.sharedTeams.map((t) => t.id)).toEqual([1])
    const shareableIds = [...controller.shareableListTarget.querySelectorAll("[data-team-id]")]
      .map((el) => Number(el.dataset.teamId))
    expect(shareableIds).toEqual([2])
    expect(controller.emptyShareableTarget.classList.contains("d-none")).toBe(true)
    expect(controller.sharePickerTarget.classList.contains("d-none")).toBe(false)
    expect(controller.sharedSectionTarget.classList.contains("d-none")).toBe(false)
    expect(controller.submitButtonTarget.classList.contains("d-none")).toBe(true)
  })

  it("selectTeam marks a share action", () => {
    const controller = buildController()
    controller.applyTeamLists(
      [
        { id: 1, name: "OSC" },
        { id: 2, name: "Other" }
      ],
      [{ id: 1, name: "OSC" }]
    )
    const sharedItem = controller.sharedListTarget.querySelector("[data-team-id='1']")
    controller.toggleCoreSharedSelect({ currentTarget: sharedItem }, { id: 1, name: "OSC" })
    expect(controller.selectedSharedTeamId).toBe(1)

    const shareableItem = controller.shareableListTarget.querySelector("[data-team-id='2']")
    controller.toggleShareSelect({ currentTarget: shareableItem }, { id: 2, name: "Other" })

    expect(controller.selectedShareTeamId).toBe(2)
    expect(controller.submitButtonTarget.classList.contains("d-none")).toBe(false)
    expect(controller.submitButtonTarget.textContent).toBe("Share with Other")
    expect(controller.selectedSharedTeamId).toBe(null)
    expect(controller.unshareButtonTarget.classList.contains("d-none")).toBe(true)
  })
})

describe("ShareCaseCoreController — API share/unshare", () => {
  // HTTP contracts: Karma teamSvc_spec.js shareCase / unshareCase (Stimulus uses apiFetch instead).
  // Event emission: Karma caseSvc_spec.js quepid:case-team-changed bridge (receiver stays in Karma).
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("opens the share modal with the bound case", async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(TEAM_PAYLOAD)
    })

    const controller = buildController()
    const preventDefault = vi.fn()
    await ShareCaseCoreController.prototype.open.call(controller, {
      preventDefault,
      currentTarget: {
        dataset: {
          shareCaseCoreIdValue: "5",
          shareCaseCoreNameValue: "Demo Case"
        }
      }
    })

    expect(preventDefault).toHaveBeenCalled()
    expect(apiFetch).toHaveBeenCalledWith("/api/teams", {
      headers: { Accept: "application/json" }
    })
    expect(controller.titleTarget.textContent).toBe("Share Case: Demo Case")
    expect(controller.caseIdTarget.value).toBe("5")
    expect(controller.currentCaseId).toBe("5")
    expect(controller.unshareCaseIdTarget.value).toBe("5")
  })

  it("shows danger alert when share API fails", async () => {
    apiFetch.mockResolvedValue({
      ok: false,
      status: 422,
      statusText: "Unprocessable Entity",
      json: () => Promise.resolve({ error: "Team already has this case" })
    })

    const controller = buildController()
    controller.currentCaseId = "5"
    controller.allTeams = [{ id: 2, name: "Other" }]
    controller.sharedTeams = []
    controller.selectedShareTeamId = 2
    controller.selectedShareTeamName = "Other"

    await ShareCaseCoreController.prototype.submitShare.call(controller, {
      preventDefault: vi.fn()
    })

    expect(controller.alertTarget.textContent).toBe("Team already has this case")
    expect(controller.alertTarget.className).toBe("alert alert-danger")
    expect(controller.sharedTeams).toEqual([])
  })

  it("shows danger alert when unshare API fails", async () => {
    apiFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: () => Promise.resolve({ message: "Server blew up" })
    })

    const controller = buildController()
    controller.currentCaseId = "5"
    controller.selectedSharedTeamId = 1
    controller.selectedSharedTeamName = "OSC"
    controller.allTeams = [{ id: 1, name: "OSC" }]
    controller.sharedTeams = [{ id: 1, name: "OSC" }]

    await ShareCaseCoreController.prototype.submitUnshare.call(controller, {
      preventDefault: vi.fn()
    })

    expect(controller.alertTarget.textContent).toBe("Server blew up")
    expect(controller.alertTarget.className).toBe("alert alert-danger")
    expect(controller.sharedTeams).toEqual([{ id: 1, name: "OSC" }])
  })

  it("shows danger alert when loading teams fails on open", async () => {
    apiFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Error"
    })

    const controller = buildController()
    await ShareCaseCoreController.prototype.open.call(controller, {
      currentTarget: {
        dataset: {
          shareCaseCoreIdValue: "5",
          shareCaseCoreNameValue: "Demo Case"
        }
      }
    })

    expect(controller.alertTarget.textContent).toBe("Unable to load teams. Please try again.")
    expect(controller.alertTarget.className).toBe("alert alert-danger")
    expect(controller.sharedTeams).toEqual([])
  })

  it("shares via API and dispatches quepid:case-team-changed", async () => {
    apiFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
    const dispatchSpy = vi.spyOn(document, "dispatchEvent")

    const controller = buildController()
    controller.currentCaseId = "5"
    controller.allTeams = [
      { id: 2, name: "Other" },
      { id: 1, name: "OSC" }
    ]
    controller.sharedTeams = [{ id: 1, name: "OSC" }]
    controller.selectedShareTeamId = 2
    controller.selectedShareTeamName = "Other"

    await ShareCaseCoreController.prototype.submitShare.call(controller, {
      preventDefault: vi.fn()
    })

    expect(apiFetch).toHaveBeenCalledWith("/api/teams/2/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ id: 5 })
    })
    expect(controller.alertTarget.textContent).toBe("Case shared with team successfully.")
    expect(controller.sharedTeams.map((t) => t.id)).toEqual([1, 2])

    const event = dispatchSpy.mock.calls.find((c) => c[0].type === "quepid:case-team-changed")?.[0]
    expect(event.detail).toEqual({
      action: "added",
      caseNo: 5,
      team: { id: 2, name: "Other" }
    })
  })

  it("unshares via API and dispatches quepid:case-team-changed", async () => {
    apiFetch.mockResolvedValue({ ok: true, status: 204, json: () => Promise.resolve({}) })
    const dispatchSpy = vi.spyOn(document, "dispatchEvent")

    const controller = buildController()
    controller.currentCaseId = "5"
    controller.selectedSharedTeamId = 1
    controller.selectedSharedTeamName = "OSC"
    controller.allTeams = [{ id: 1, name: "OSC" }]
    controller.sharedTeams = [{ id: 1, name: "OSC" }]

    await ShareCaseCoreController.prototype.submitUnshare.call(controller, {
      preventDefault: vi.fn()
    })

    expect(apiFetch).toHaveBeenCalledWith("/api/teams/1/cases/5", {
      method: "DELETE",
      headers: { Accept: "application/json" }
    })
    expect(controller.sharedTeams).toEqual([])

    const event = dispatchSpy.mock.calls.find((c) => c[0].type === "quepid:case-team-changed")?.[0]
    expect(event.detail).toEqual({
      action: "removed",
      caseNo: 5,
      team: { id: 1, name: "OSC" }
    })
  })

  it("openFromExternal shows modal and loads teams", async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(TEAM_PAYLOAD)
    })
    window.bootstrap = {
      Modal: {
        getOrCreateInstance: vi.fn(() => ({ show: vi.fn() }))
      }
    }

    const controller = buildController()
    controller.element = document.createElement("div")

    await ShareCaseCoreController.prototype.openFromExternal.call(controller, {
      detail: { caseNo: 5, caseName: "From Judgements" }
    })

    expect(window.bootstrap.Modal.getOrCreateInstance).toHaveBeenCalled()
    expect(controller.titleTarget.textContent).toBe("Share Case: From Judgements")
    expect(controller.currentCaseId).toBe("5")
  })
})
