import { beforeEach, describe, expect, it, vi } from "vitest"
import ShareBookController from "./share_book_controller"

function buildController(overrides = {}) {
  const teamSelect = document.createElement("select")
  teamSelect.id = "share-book-team"
  const submitButton = document.createElement("button")
  const unshareButton = document.createElement("button")
  submitButton.disabled = true
  unshareButton.disabled = true

  const controller = Object.create(ShareBookController.prototype)
  controller.element = document.createElement("div")
  controller.application = {
    getControllerForElementAndIdentifier: vi.fn(() => null)
  }
  controller.identifier = "share-book"
  controller.selectedSharedTeamId = null
  controller.idValue = ""
  controller.nameValue = ""
  controller.allTeamsJsonValue = ""
  controller.sharedTeamsJsonValue = ""
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

describe("ShareBookController — Rails books index / teams", () => {
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

  it("open reads its own Values-API data and populates the modal", () => {
    const controller = buildController({
      idValue: "5",
      nameValue: "Index Book",
      allTeamsJsonValue: JSON.stringify([
        { id: 1, name: "OSC" },
        { id: 2, name: "Other" }
      ]),
      sharedTeamsJsonValue: JSON.stringify([{ id: 1, name: "OSC" }])
    })

    controller.open()

    expect(controller.titleTarget.textContent).toBe("Share Book: Index Book")
    expect(controller.recordIdTarget.value).toBe("5")
    expect([...controller.teamSelectTarget.options].map((o) => o.text)).toEqual([
      "Select a team...",
      "Other"
    ])
    expect(controller.sharedListTarget.querySelectorAll("[data-team-id]").length).toBe(1)
    expect(controller.submitButtonTarget.disabled).toBe(true)
    expect(controller.unshareButtonTarget.disabled).toBe(true)
  })

  it("a non-root trigger delegates its own values to the modal root's openWith", () => {
    const modalElement = document.createElement("div")
    modalElement.id = "shareBookModal"
    document.body.appendChild(modalElement)

    const modalController = buildController()
    const openWithSpy = vi.spyOn(modalController, "openWith")

    const trigger = buildController({
      hasTitleTarget: false,
      idValue: "7",
      nameValue: "Trigger Book",
      allTeamsJsonValue: JSON.stringify([{ id: 1, name: "OSC" }]),
      sharedTeamsJsonValue: "[]",
      application: {
        getControllerForElementAndIdentifier: vi.fn(() => modalController)
      }
    })

    trigger.open()

    expect(openWithSpy).toHaveBeenCalledWith({
      id: "7",
      name: "Trigger Book",
      allTeamsJson: JSON.stringify([{ id: 1, name: "OSC" }]),
      sharedTeamsJson: "[]"
    })

    modalElement.remove()
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
