import { beforeEach, describe, expect, it, vi } from "vitest"
import ShareCaseController from "controllers/share_case_controller"

function buildController(overrides = {}) {
  const teamSelect = document.createElement("select")
  teamSelect.id = "share-case-team"
  const submitButton = document.createElement("button")
  const unshareButton = document.createElement("button")
  submitButton.disabled = true
  unshareButton.disabled = true

  const controller = Object.create(ShareCaseController.prototype)
  controller.element = document.createElement("div")
  controller.identifier = "share-case"
  controller.selectedSharedTeamId = null
  controller.hasTitleTarget = true
  controller.titleTarget = document.createElement("h5")
  controller.hasRecordIdTarget = true
  controller.recordIdTarget = { value: "" }
  controller.hasUnshareRecordIdTarget = true
  controller.unshareRecordIdTarget = { value: "" }
  controller.hasUnshareTeamIdTarget = true
  controller.unshareTeamIdTarget = { value: "" }
  controller.hasTeamSelectTarget = true
  controller.teamSelectTarget = teamSelect
  controller.hasSharedListTarget = true
  controller.sharedListTarget = document.createElement("div")
  controller.hasSubmitButtonTarget = true
  controller.submitButtonTarget = submitButton
  controller.hasUnshareButtonTarget = true
  controller.unshareButtonTarget = unshareButton

  Object.assign(controller, overrides)
  return controller
}

describe("ShareCaseController — Rails cases index / teams", () => {
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
    trigger.setAttribute("data-share-case-id-value", "5")
    trigger.setAttribute("data-share-case-name-value", "Index Case")
    trigger.setAttribute(
      "data-share-case-all-teams-json-value",
      JSON.stringify([
        { id: 1, name: "OSC" },
        { id: 2, name: "Other" }
      ])
    )
    trigger.setAttribute("data-share-case-shared-teams-json-value", JSON.stringify([{ id: 1, name: "OSC" }]))

    controller.open({ target: controller.element, relatedTarget: trigger })

    expect(controller.titleTarget.textContent).toBe("Share Case: Index Case")
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
