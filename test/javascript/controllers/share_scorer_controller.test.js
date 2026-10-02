import { buildControllerFixture } from "../support/controller_fixture"
import { beforeEach, describe, expect, it, vi } from "vitest"
import ShareScorerController from "controllers/share_scorer_controller"

function buildController(overrides = {}) {
  const teamSelect = document.createElement("select")
  teamSelect.id = "share-scorer-team"
  const submitButton = document.createElement("button")
  const unshareButton = document.createElement("button")
  submitButton.disabled = true
  unshareButton.disabled = true

  const controller = buildControllerFixture(ShareScorerController, {
    targets: {
      title: document.createElement("h5"),
      recordId: { value: "" },
      unshareRecordId: { value: "" },
      unshareTeamId: { value: "" },
      sharedList: document.createElement("div"),
      teamSelect,
      submitButton,
      unshareButton
    }
  })
  controller.identifier = "share-scorer"
  controller.selectedSharedTeamId = null

  Object.assign(controller, overrides)
  return controller
}

describe("ShareScorerController — Rails scorers index / teams", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("rebuildTeamDropdown excludes already-shared teams", () => {
    const controller = buildController()
    controller.rebuildTeamDropdown(
      JSON.stringify([
        { id: 1, name: "OSC" },
        { id: 2, name: "Other" }
      ]),
      JSON.stringify([{ id: 1, name: "OSC" }])
    )

    const options = [...controller.teamSelectTarget.options].map((o) => o.text)
    expect(options).toEqual(["Select a team...", "Other"])
    expect(controller.teamSelectTarget.disabled).toBe(false)
  })

  it("toggleSubmit enables share footer only when a team is selected", () => {
    const controller = buildController()
    controller.rebuildTeamDropdown(
      JSON.stringify([
        { id: 1, name: "OSC" },
        { id: 2, name: "Other" }
      ]),
      JSON.stringify([])
    )

    controller.toggleSubmit()
    expect(controller.submitButtonTarget.disabled).toBe(true)

    controller.teamSelectTarget.value = "2"
    controller.toggleSubmit()
    expect(controller.submitButtonTarget.disabled).toBe(false)
  })

  it("open reads the clicked trigger's data attributes and populates the modal", () => {
    const controller = buildController()
    const trigger = document.createElement("button")
    trigger.setAttribute("data-share-scorer-id-value", "5")
    trigger.setAttribute("data-share-scorer-name-value", "Index Scorer")
    trigger.setAttribute(
      "data-share-scorer-all-teams-json-value",
      JSON.stringify([
        { id: 1, name: "OSC" },
        { id: 2, name: "Other" }
      ])
    )
    trigger.setAttribute("data-share-scorer-shared-teams-json-value", JSON.stringify([{ id: 1, name: "OSC" }]))

    controller.open({ target: controller.element, relatedTarget: trigger })

    expect(controller.titleTarget.textContent).toBe("Share Scorer: Index Scorer")
    expect(controller.recordIdTarget.value).toBe("5")
    expect([...controller.teamSelectTarget.options].map((o) => o.text)).toEqual([
      "Select a team...",
      "Other"
    ])
    expect(controller.sharedListTarget.querySelectorAll("[data-team-id]").length).toBe(1)
    expect(controller.submitButtonTarget.disabled).toBe(true)
    expect(controller.unshareButtonTarget.disabled).toBe(true)
  })

  it("toggleRailsSharedSelect toggles unshare footer", () => {
    const controller = buildController()
    controller.renderSharedTeamsFromJson(JSON.stringify([{ id: 1, name: "OSC" }]))
    const item = controller.sharedListTarget.querySelector("[data-team-id='1']")

    controller.toggleRailsSharedSelect({ currentTarget: item }, { id: 1, name: "OSC" })
    expect(controller.selectedSharedTeamId).toBe(1)
    expect(controller.unshareButtonTarget.disabled).toBe(false)
    expect(controller.unshareTeamIdTarget.value).toBe("1")

    controller.toggleRailsSharedSelect({ currentTarget: item }, { id: 1, name: "OSC" })
    expect(controller.selectedSharedTeamId).toBe(null)
    expect(controller.unshareButtonTarget.disabled).toBe(true)
  })
})
