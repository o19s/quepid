import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import ShareEntityControllerBase from "controllers/share_entity_controller_base"

class ShareWidgetController extends ShareEntityControllerBase {
  get entityLabel() {
    return "Widget"
  }

  get modalElementId() {
    return "shareWidgetModal"
  }
}

const TARGETS = {
  recordId: () => document.createElement("input"),
  unshareRecordId: () => document.createElement("input"),
  unshareTeamId: () => document.createElement("input"),
  teamSelect: () => document.createElement("select"),
  title: () => document.createElement("h5"),
  submitButton: () => document.createElement("button"),
  unshareButton: () => document.createElement("button"),
  sharedList: () => document.createElement("div")
}

// The modal root: every target present unless listed in `without`.
function buildModal({ without = [] } = {}) {
  const controller = Object.create(ShareWidgetController.prototype)
  controller.element = document.createElement("div")
  controller.identifier = "share-widget"
  for (const [name, make] of Object.entries(TARGETS)) {
    const has = !without.includes(name)
    controller[`has${name[0].toUpperCase()}${name.slice(1)}Target`] = has
    if (has) controller[`${name}Target`] = make()
  }
  controller.connect()
  return controller
}

function buildTrigger(values, application) {
  const controller = Object.create(ShareWidgetController.prototype)
  controller.identifier = "share-widget"
  controller.hasTitleTarget = false
  controller.application = application
  Object.assign(controller, values)
  return controller
}

const teams = JSON.stringify([
  { id: 1, name: "OSC" },
  { id: 2, name: "Search" },
  { id: 3, name: "Relevance" }
])

function teamRows(controller) {
  return [...controller.sharedListTarget.querySelectorAll("[data-team-id]")]
}

// The Stimulus stub does not route data-action, so resolve the row's declared
// action and typed param the way Stimulus would.
function clickRow(controller, row) {
  const [, identifier, method] = row.dataset.action.match(/^click->([\w-]+)#(\w+)$/)
  const teamId = JSON.parse(row.getAttribute(`data-${identifier}-team-id-param`))
  controller[method]({ type: "click", currentTarget: row, params: { teamId } })
}

describe("ShareEntityControllerBase", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("fills both forms' record id and titles the modal with the entity label", () => {
    const controller = buildModal()

    controller.openWith({ id: 42, name: "Shoes", allTeamsJson: teams, sharedTeamsJson: "[]" })

    expect(controller.recordIdTarget.value).toBe("42")
    expect(controller.unshareRecordIdTarget.value).toBe("42")
    expect(controller.titleTarget.textContent).toBe("Share Widget: Shoes")
  })

  it("titles the modal without a name and blanks a missing id", () => {
    const controller = buildModal()
    controller.recordIdTarget.value = "9"
    controller.unshareRecordIdTarget.value = "9"

    controller.openWith({ allTeamsJson: teams, sharedTeamsJson: "[]" })

    expect(controller.titleTarget.textContent).toBe("Share Widget")
    expect(controller.recordIdTarget.value).toBe("")
    expect(controller.unshareRecordIdTarget.value).toBe("")
  })

  it("lists shared teams as buttons, falling back to the team id for unnamed teams", () => {
    const controller = buildModal()

    controller.openWith({
      id: 1,
      allTeamsJson: teams,
      sharedTeamsJson: JSON.stringify([{ id: 1, name: "OSC" }, { id: 7 }])
    })

    const rows = teamRows(controller)
    expect(rows.map((row) => row.textContent)).toEqual(["OSC", "Team 7"])
    expect(rows.map((row) => row.dataset.teamId)).toEqual(["1", "7"])
    expect(rows[0].type).toBe("button")
    expect(rows[0].className).toBe("list-group-item list-group-item-action list-group-item-success")
    expect(rows[0].dataset.action).toBe("click->share-widget#selectSharedTeam")
    expect(rows[1].getAttribute("data-share-widget-team-id-param")).toBe("7")
  })

  it("says so when nothing is shared yet, and keeps unshare disabled", () => {
    const controller = buildModal()
    controller.unshareButtonTarget.disabled = false

    controller.openWith({ id: 1, allTeamsJson: teams, sharedTeamsJson: "[]" })

    expect(controller.sharedListTarget.textContent).toBe("Not shared with any teams yet.")
    expect(controller.sharedListTarget.querySelector("p.text-muted")).not.toBe(null)
    expect(controller.unshareButtonTarget.disabled).toBe(true)
  })

  it("replaces the previous record's shared teams when reopened", () => {
    const controller = buildModal()
    controller.openWith({ id: 1, allTeamsJson: teams, sharedTeamsJson: teams })

    controller.openWith({
      id: 2,
      allTeamsJson: teams,
      sharedTeamsJson: JSON.stringify([{ id: 2, name: "Search" }])
    })

    expect(teamRows(controller).map((row) => row.textContent)).toEqual(["Search"])
    expect(controller.sharedListTarget.children).toHaveLength(1)
  })

  it("disables the team picker when every team already has access", () => {
    const controller = buildModal()

    controller.openWith({ id: 1, allTeamsJson: teams, sharedTeamsJson: teams })

    const options = [...controller.teamSelectTarget.options]
    expect(options.map((option) => [option.value, option.text])).toEqual([
      ["", "Select a team..."],
      ["", "No other teams to share with"]
    ])
    expect(controller.teamSelectTarget.disabled).toBe(true)
    expect(controller.submitButtonTarget.disabled).toBe(true)
  })

  it("re-enables the picker and clears the old choice on reopen", () => {
    const controller = buildModal()
    controller.openWith({ id: 1, allTeamsJson: teams, sharedTeamsJson: teams })

    controller.openWith({ id: 2, allTeamsJson: teams, sharedTeamsJson: "[]" })
    controller.teamSelectTarget.value = "3"
    controller.toggleSubmit()
    expect(controller.submitButtonTarget.disabled).toBe(false)

    controller.openWith({ id: 3, allTeamsJson: teams, sharedTeamsJson: "[]" })

    expect(controller.teamSelectTarget.disabled).toBe(false)
    expect(controller.teamSelectTarget.value).toBe("")
    expect(controller.submitButtonTarget.disabled).toBe(true)
  })

  it("selects a team to unshare by clicking its row, and moves the selection on another click", () => {
    const controller = buildModal()
    controller.openWith({ id: 1, allTeamsJson: teams, sharedTeamsJson: teams })
    const [osc, search] = teamRows(controller)

    clickRow(controller, osc)
    expect(osc.classList.contains("active")).toBe(true)
    expect(controller.unshareTeamIdTarget.value).toBe("1")
    expect(controller.unshareButtonTarget.disabled).toBe(false)

    clickRow(controller, search)
    expect(osc.classList.contains("active")).toBe(false)
    expect(search.classList.contains("active")).toBe(true)
    expect(controller.unshareTeamIdTarget.value).toBe("2")

    clickRow(controller, search)
    expect(search.classList.contains("active")).toBe(false)
    expect(controller.unshareTeamIdTarget.value).toBe("")
    expect(controller.unshareButtonTarget.disabled).toBe(true)
  })

  it("clears a pending unshare selection when reopened for another record", () => {
    const controller = buildModal()
    controller.openWith({ id: 1, allTeamsJson: teams, sharedTeamsJson: teams })
    clickRow(controller, teamRows(controller)[0])

    controller.openWith({ id: 2, allTeamsJson: teams, sharedTeamsJson: teams })

    expect(controller.selectedSharedTeamId).toBe(null)
    expect(controller.unshareTeamIdTarget.value).toBe("")
    expect(controller.unshareButtonTarget.disabled).toBe(true)
  })

  it("prevents the trigger's default action and hands its values to the modal root", () => {
    const modalElement = document.createElement("div")
    modalElement.id = "shareWidgetModal"
    document.body.appendChild(modalElement)
    const modal = buildModal()
    const application = { getControllerForElementAndIdentifier: vi.fn(() => modal) }
    const trigger = buildTrigger(
      { idValue: "5", nameValue: "Boots", allTeamsJsonValue: teams, sharedTeamsJsonValue: "[]" },
      application
    )
    const event = { preventDefault: vi.fn() }

    trigger.open(event)

    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(application.getControllerForElementAndIdentifier).toHaveBeenCalledWith(
      modalElement,
      "share-widget"
    )
    expect(modal.titleTarget.textContent).toBe("Share Widget: Boots")
    expect(modal.unshareRecordIdTarget.value).toBe("5")
  })

  it("does nothing when the page has no share modal", () => {
    const application = { getControllerForElementAndIdentifier: vi.fn(() => buildModal()) }
    const trigger = buildTrigger({ idValue: "5" }, application)

    expect(() => trigger.open()).not.toThrow()
    expect(trigger.modalController()).toBe(null)
    expect(application.getControllerForElementAndIdentifier).not.toHaveBeenCalled()
  })

  it("does nothing when the modal's controller hasn't connected yet", () => {
    const modalElement = document.createElement("div")
    modalElement.id = "shareWidgetModal"
    document.body.appendChild(modalElement)
    const trigger = buildTrigger(
      { idValue: "5" },
      { getControllerForElementAndIdentifier: vi.fn(() => null) }
    )

    expect(() => trigger.open()).not.toThrow()
  })

  it("tolerates a modal that only renders some of its targets", () => {
    const controller = buildModal({
      without: ["recordId", "unshareRecordId", "unshareTeamId", "submitButton", "sharedList"]
    })

    controller.openWith({ id: 1, name: "Shoes", allTeamsJson: teams, sharedTeamsJson: "[]" })
    expect(controller.teamSelectTarget.options).toHaveLength(4)

    const bare = buildModal({ without: Object.keys(TARGETS) })
    expect(() => {
      bare.openWith({ id: 1, allTeamsJson: teams, sharedTeamsJson: teams })
      bare.toggleUnshareSubmit()
    }).not.toThrow()
  })

  it("lets unshare work in a modal without a hidden team-id field", () => {
    const controller = buildModal({ without: ["unshareTeamId"] })
    controller.openWith({ id: 1, allTeamsJson: teams, sharedTeamsJson: teams })

    const row = teamRows(controller)[1]

    controller.toggleRailsSharedSelect({ currentTarget: row }, { id: 2, name: "Search" })

    expect(controller.unshareButtonTarget.disabled).toBe(false)
    expect(row.classList.contains("active")).toBe(true)
  })
})
