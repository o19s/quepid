import { teamCatalogHtml } from "../support/modal_catalog_html"
import { buildControllerFixture } from "../support/controller_fixture"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { apiFetch } from "api/fetch"
import ShareCaseCoreController from "controllers/share_case_core_controller"
import { mountCaseHeader } from "../support/case_header_dom"

vi.mock("api/fetch", () => ({
  apiFetch: vi.fn()
}))

function buildController(overrides = {}) {
  const controller = buildControllerFixture(ShareCaseCoreController, {
    overrides: { identifier: "share-case-core" },
    targets: {
      title: document.createElement("h5"),
      caseId: { value: "" },
      unshareCaseId: { value: "" },
      teamId: { value: "" },
      unshareTeamId: { value: "" },
      sharedList: document.createElement("div"),
      submitButton: document.createElement("button"),
      unshareButton: document.createElement("button"),
      alert: document.createElement("div"),
      loading: document.createElement("div"),
      bodyContent: document.createElement("div"),
      emptyShareable: document.createElement("div"),
      sharePicker: document.createElement("div"),
      shareableList: document.createElement("div"),
      sharedSection: document.createElement("div")
    },
    values: {
      catalogUrlTemplate: "/cases/__CASE_ID__/modal_catalogs/sharing",
      teamCasesUrlTemplate: "/api/teams/__TEAM_ID__/cases",
      teamCaseUrlTemplate: "/api/teams/__TEAM_ID__/cases/__CASE_ID__"
    }
  })
  controller.selectedShareTeamId = null
  controller.selectedShareTeamName = null
  controller.selectedSharedTeamId = null
  controller.selectedSharedTeamName = null
  controller.currentCaseId = null
  controller.teamRows = []
  controller.sharedRows = []
  controller.submitButtonTarget.classList.add("d-none")
  controller.unshareButtonTarget.classList.add("d-none")
  controller.emptyShareableTarget.classList.add("d-none")
  controller.sharedSectionTarget.classList.add("d-none")

  Object.assign(controller, overrides)
  return controller
}

function mountTeams(controller, allTeams, sharedTeams) {
  const catalog = new DOMParser().parseFromString(teamCatalogHtml(allTeams, sharedTeams), "text/html")
  controller.sharedRows = [...catalog.querySelector('[data-catalog-list="shared"]').children]
  controller.teamRows = [...catalog.querySelectorAll("[data-team-id]")].sort(
    (a, b) => Number(a.dataset.teamOrder) - Number(b.dataset.teamOrder)
  )
  controller.renderTeamLists()
}

function sharedTeams(controller) {
  return [...controller.sharedListTarget.children].map((row) => controller.teamFor(row))
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
  it("renders safe team names with distinct shipped actions and replaces old rows", () => {
    const controller = buildController()
    const teams = [{ id: 8, name: "<img src=x onerror=alert(1)>" }]
    mountTeams(controller, teams, [])
    mountTeams(controller, teams, [])
    expect(controller.shareableListTarget.querySelectorAll("button")).toHaveLength(1)
    expect(controller.shareableListTarget.querySelector("img")).toBeNull()
    expect(controller.shareableListTarget.textContent).toBe(teams[0].name)
    expect(controller.shareableListTarget.firstElementChild.dataset.action).toBe("click->share-case-core#selectShareTeam")
    mountTeams(controller, teams, teams)
    expect(controller.sharedListTarget.firstElementChild.dataset.action).toBe("click->share-case-core#selectSharedTeam")
    expect(controller.sharedListTarget.firstElementChild.classList.contains("list-group-item-success")).toBe(true)
  })

  // List partition / selection contract (no older unit spec existed).
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("partitions teams into shareable vs already shared for the case", async () => {
    apiFetch.mockResolvedValue({
      async text() {
        const data = await this.json()
        return data.teams ? teamCatalogHtml(data.teams, data.teams.filter((t) => t.cases.some((c) => c.case_id === 5))) : JSON.stringify(data)
      },
      ok: true,
      json: () => Promise.resolve(TEAM_PAYLOAD)
    })

    const controller = buildController()
    mountCaseHeader("Demo Case")
    await ShareCaseCoreController.prototype.openFor.call(controller, {
      dataset: { shareCaseCoreIdValue: "5" }
    })

    expect(controller.loadingTarget.classList.contains("d-none")).toBe(true)
    expect(sharedTeams(controller).map((t) => t.id)).toEqual([1])
    const shareableIds = [...controller.shareableListTarget.querySelectorAll("[data-team-id]")]
      .map((el) => Number(el.dataset.teamId))
    expect(shareableIds).toEqual([2])
    expect(controller.emptyShareableTarget.classList.contains("d-none")).toBe(true)
    expect(controller.sharePickerTarget.classList.contains("d-none")).toBe(false)
    expect(controller.sharedSectionTarget.classList.contains("d-none")).toBe(false)
    expect(controller.submitButtonTarget.classList.contains("d-none")).toBe(true)
  })

  it("hides the no-teams prompt when every team already shares the case", () => {
    const controller = buildController()
    const teams = [{ id: 1, name: "OSC" }]

    mountTeams(controller, teams, teams)

    expect(controller.emptyShareableTarget.classList.contains("d-none")).toBe(true)
    expect(controller.sharePickerTarget.classList.contains("d-none")).toBe(true)
    expect(controller.sharedSectionTarget.classList.contains("d-none")).toBe(false)
  })

  it("shows the no-teams prompt only when the user has no teams", () => {
    const controller = buildController()

    mountTeams(controller, [], [])

    expect(controller.emptyShareableTarget.classList.contains("d-none")).toBe(false)
  })

  it("selectTeam marks a share action", () => {
    const controller = buildController()
    mountTeams(controller,
      [
        { id: 1, name: "OSC" },
        { id: 2, name: "Other" }
      ],
      [{ id: 1, name: "OSC" }]
    )
    const sharedItem = controller.sharedListTarget.querySelector("[data-team-id='1']")
    expect(sharedItem.dataset.action).toBe("click->share-case-core#selectSharedTeam")
    expect(sharedItem.dataset.shareCaseCoreTeamIdParam).toBe("1")
    controller.selectSharedTeam({ currentTarget: sharedItem, params: { teamId: 1 } })
    expect(controller.selectedSharedTeamId).toBe(1)

    const shareableItem = controller.shareableListTarget.querySelector("[data-team-id='2']")
    expect(shareableItem.dataset.action).toBe("click->share-case-core#selectShareTeam")
    expect(shareableItem.dataset.shareCaseCoreTeamIdParam).toBe("2")
    controller.selectShareTeam({ currentTarget: shareableItem, params: { teamId: 2 } })

    expect(controller.selectedShareTeamId).toBe(2)
    expect(controller.submitButtonTarget.classList.contains("d-none")).toBe(false)
    expect(controller.submitButtonTarget.textContent).toBe("Share with Other")
    expect(controller.selectedSharedTeamId).toBe(null)
    expect(controller.unshareButtonTarget.classList.contains("d-none")).toBe(true)
  })
})

describe("ShareCaseCoreController — API share/unshare", () => {
  // HTTP contracts: Karma teamSvc_spec.js shareCase / unshareCase (Stimulus uses apiFetch instead).
  // Event emission: the core share flow dispatches a native case-team-changed event.
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("opens the share modal with the bound case", async () => {
    apiFetch.mockResolvedValue({
      async text() {
        const data = await this.json()
        return data.teams ? teamCatalogHtml(data.teams, data.teams.filter((t) => t.cases.some((c) => c.case_id === 5))) : JSON.stringify(data)
      },
      ok: true,
      json: () => Promise.resolve(TEAM_PAYLOAD)
    })

    const controller = buildController()
    mountCaseHeader("Demo Case")
    await ShareCaseCoreController.prototype.openFor.call(controller, {
      dataset: { shareCaseCoreIdValue: "5" }
    })

    expect(apiFetch).toHaveBeenCalledWith("/cases/5/modal_catalogs/sharing", {
      headers: { Accept: "text/html" }
    })
    expect(controller.titleTarget.textContent).toBe("Share Case: Demo Case")
    expect(controller.caseIdTarget.value).toBe("5")
    expect(controller.currentCaseId).toBe("5")
    expect(controller.unshareCaseIdTarget.value).toBe("5")
  })

  it("shows danger alert when share API fails", async () => {
    apiFetch.mockResolvedValue({
      async text() {
        const data = await this.json()
        return data.teams ? teamCatalogHtml(data.teams, data.teams.filter((t) => t.cases.some((c) => c.case_id === 5))) : JSON.stringify(data)
      },
      ok: false,
      status: 422,
      statusText: "Unprocessable Entity",
      json: () => Promise.resolve({ error: "Team already has this case" })
    })

    const controller = buildController()
    controller.currentCaseId = "5"
    mountTeams(controller, [{ id: 2, name: "Other" }], [])
    controller.selectedShareTeamId = 2
    controller.selectedShareTeamName = "Other"

    await ShareCaseCoreController.prototype.submitShare.call(controller, {
      preventDefault: vi.fn()
    })

    expect(controller.alertTarget.textContent).toBe("Team already has this case")
    expect(controller.alertTarget.className).toBe("alert alert-danger")
    expect(sharedTeams(controller)).toEqual([])
  })

  it("appends a newly shared team and restores its original position after unshare", async () => {
    apiFetch.mockResolvedValue({ ok: true, status: 204 })
    const controller = buildController()
    controller.currentCaseId = "5"
    const teams = [
      { id: 1, name: "First" },
      { id: 2, name: "Second" },
      { id: 3, name: "Third" }
    ]
    mountTeams(controller, teams, [teams[2]])
    controller.selectShareTeam({ currentTarget: controller.shareableListTarget.firstElementChild })
    await controller.submitShare({ preventDefault: vi.fn() })
    expect(sharedTeams(controller).map((team) => team.id)).toEqual([3, 1])
    controller.selectSharedTeam({ currentTarget: controller.sharedListTarget.lastElementChild })
    await controller.submitUnshare({ preventDefault: vi.fn() })
    expect([...controller.shareableListTarget.children].map((row) => row.textContent)).toEqual(["First", "Second"])
    expect(sharedTeams(controller).map((team) => team.id)).toEqual([3])
  })

  it("shows danger alert when unshare API fails", async () => {
    apiFetch.mockResolvedValue({
      async text() {
        const data = await this.json()
        return data.teams ? teamCatalogHtml(data.teams, data.teams.filter((t) => t.cases.some((c) => c.case_id === 5))) : JSON.stringify(data)
      },
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: () => Promise.resolve({ message: "Server blew up" })
    })

    const controller = buildController()
    controller.currentCaseId = "5"
    controller.selectedSharedTeamId = 1
    controller.selectedSharedTeamName = "OSC"
    mountTeams(controller, [{ id: 1, name: "OSC" }], [{ id: 1, name: "OSC" }])

    await ShareCaseCoreController.prototype.submitUnshare.call(controller, {
      preventDefault: vi.fn()
    })

    expect(controller.alertTarget.textContent).toBe("Server blew up")
    expect(controller.alertTarget.className).toBe("alert alert-danger")
    expect(sharedTeams(controller)).toEqual([{ id: 1, name: "OSC" }])
  })

  it("shows danger alert when loading teams fails on open", async () => {
    apiFetch.mockResolvedValue({ text: async () => "", json: async () => null,
      ok: false,
      status: 500,
      statusText: "Error"
    })

    const controller = buildController()
    mountCaseHeader("Demo Case")
    await ShareCaseCoreController.prototype.openFor.call(controller, {
      dataset: { shareCaseCoreIdValue: "5" }
    })

    expect(controller.alertTarget.textContent).toBe("Unable to load teams. Please try again.")
    expect(controller.alertTarget.className).toBe("alert alert-danger")
    expect(sharedTeams(controller)).toEqual([])

    // resetTeamListsForError: the "no teams" placeholder must stay hidden on
    // a load failure — showing it here would misleadingly suggest the case
    // truly has zero teams instead of a failed request (PR #1764).
    expect(controller.emptyShareableTarget.classList.contains("d-none")).toBe(true)
    expect(controller.sharePickerTarget.classList.contains("d-none")).toBe(true)
    expect(controller.sharedSectionTarget.classList.contains("d-none")).toBe(true)
  })

  it("ignores a stale teams response that resolves after the case changed", async () => {
    let resolveFirstFetch
    const firstFetch = new Promise((resolve) => {
      resolveFirstFetch = resolve
    })
    const secondPayload = {
      teams: [{ id: 3, name: "Fresh", cases: [{ case_id: 9 }], members: [] }]
    }

    apiFetch
      .mockImplementationOnce(() => firstFetch)
      .mockImplementationOnce(() =>
        Promise.resolve({ text: async () => teamCatalogHtml(secondPayload.teams, secondPayload.teams), ok: true })
      )

    const controller = buildController()

    // Case 5's request starts but does not resolve yet.
    controller.currentCaseId = "5"
    const staleLoad = controller.loadTeams("5")

    // The user reopens the modal for a different case before that resolves.
    controller.currentCaseId = "9"
    await controller.loadTeams("9")

    expect(sharedTeams(controller)).toEqual([{ id: 3, name: "Fresh" }])
    expect(controller.loadingTarget.classList.contains("d-none")).toBe(true)

    // Case 5's stale response now arrives — it must not clobber case 9's UI.
    resolveFirstFetch({ text: async function () { const data = await this.json()
        return data.teams ? teamCatalogHtml(data.teams, data.teams.filter((t) => t.cases.some((c) => c.case_id === 5))) : JSON.stringify(data) },  ok: true, json: () => Promise.resolve(TEAM_PAYLOAD) })
    await staleLoad

    expect(controller.currentCaseId).toBe("9")
    expect(sharedTeams(controller)).toEqual([{ id: 3, name: "Fresh" }])
    expect(controller.loadingTarget.classList.contains("d-none")).toBe(true)
  })

  it("shares via API and dispatches quepid:case-team-changed", async () => {
    apiFetch.mockResolvedValue({ text: async function () { const data = await this.json()
        return data.teams ? teamCatalogHtml(data.teams, data.teams.filter((t) => t.cases.some((c) => c.case_id === 5))) : JSON.stringify(data) },  ok: true, json: () => Promise.resolve({}) })
    const dispatchSpy = vi.spyOn(document, "dispatchEvent")

    const controller = buildController()
    controller.currentCaseId = "5"
    mountTeams(controller, [{ id: 2, name: "Other" }, { id: 1, name: "OSC" }], [{ id: 1, name: "OSC" }])
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
    expect(sharedTeams(controller).map((t) => t.id)).toEqual([1, 2])

    const event = dispatchSpy.mock.calls.find((c) => c[0].type === "quepid:case-team-changed")?.[0]
    expect(event.detail).toEqual({
      action: "added",
      caseNo: 5,
      team: { id: 2, name: "Other" }
    })
  })

  it("unshares via API and dispatches quepid:case-team-changed", async () => {
    apiFetch.mockResolvedValue({ text: async function () { const data = await this.json()
        return data.teams ? teamCatalogHtml(data.teams, data.teams.filter((t) => t.cases.some((c) => c.case_id === 5))) : JSON.stringify(data) },  ok: true, status: 204, json: () => Promise.resolve({}) })
    const dispatchSpy = vi.spyOn(document, "dispatchEvent")

    const controller = buildController()
    controller.currentCaseId = "5"
    controller.selectedSharedTeamId = 1
    controller.selectedSharedTeamName = "OSC"
    mountTeams(controller, [{ id: 1, name: "OSC" }], [{ id: 1, name: "OSC" }])

    await ShareCaseCoreController.prototype.submitUnshare.call(controller, {
      preventDefault: vi.fn()
    })

    expect(apiFetch).toHaveBeenCalledWith("/api/teams/1/cases/5", {
      method: "DELETE",
      headers: { Accept: "application/json" }
    })
    expect(sharedTeams(controller)).toEqual([])

    const event = dispatchSpy.mock.calls.find((c) => c[0].type === "quepid:case-team-changed")?.[0]
    expect(event.detail).toEqual({
      action: "removed",
      caseNo: 5,
      team: { id: 1, name: "OSC" }
    })
  })

  it("openFromExternal shows modal and loads teams", async () => {
    mountCaseHeader("From Judgements")
    apiFetch.mockResolvedValue({
      async text() {
        const data = await this.json()
        return data.teams ? teamCatalogHtml(data.teams, data.teams.filter((t) => t.cases.some((c) => c.case_id === 5))) : JSON.stringify(data)
      },
      ok: true,
      json: () => Promise.resolve(TEAM_PAYLOAD)
    })
    const controller = buildController()
    controller.element = document.createElement("div")
    // Stand in for Bootstrap: show() fires show.bs.modal with the relatedTarget it was given.
    let opening
    const show = vi.fn((relatedTarget) => {
      opening = controller.open({ target: controller.element, relatedTarget })
    })
    window.bootstrap = {
      Modal: {
        getOrCreateInstance: vi.fn(() => ({ show }))
      }
    }

    ShareCaseCoreController.prototype.openFromExternal.call(controller, 5)
    await opening

    expect(window.bootstrap.Modal.getOrCreateInstance).toHaveBeenCalledWith(controller.element, undefined)
    expect(show).toHaveBeenCalledOnce()
    expect(controller.titleTarget.textContent).toBe("Share Case: From Judgements")
    expect(controller.currentCaseId).toBe("5")
  })
})
