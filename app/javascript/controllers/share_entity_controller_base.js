import { Controller } from "@hotwired/stimulus"
import {
  deactivateListItem,
  parseTeamsJson,
  unsharedTeams
} from "utils/share_case_teams"

/**
 * Shared base for the "share/unshare on an index page + team page" pattern used by
 * share-case/share-book/share-scorer/share-search-endpoint: `<select>` + two form
 * POSTs + redirect.
 *
 * Each row's trigger button carries `data-controller="<identifier>"` alongside this
 * controller's own `id`/`name`/`allTeamsJson`/`sharedTeamsJson` values — Stimulus
 * reads those straight off the button via the Values API. The modal element (also
 * `data-controller="<identifier>"`, elsewhere in the DOM) is the "modal root"
 * instance; a trigger's `open()` hands its values to the modal root's `openWith`.
 *
 * A concrete controller only needs to supply `entityLabel` and `modalElementId`.
 */
export default class extends Controller {
  static targets = [
    "recordId",
    "unshareRecordId",
    "unshareTeamId",
    "teamSelect",
    "title",
    "submitButton",
    "unshareButton",
    "sharedList"
  ]

  static values = {
    id: String,
    name: String,
    allTeamsJson: String,
    sharedTeamsJson: String
  }

  connect() {
    if (!this.isModalRoot) return
    this.selectedSharedTeamId = null
  }

  get isModalRoot() {
    return this.hasTitleTarget
  }

  open(event) {
    event?.preventDefault?.()

    const data = {
      id: this.idValue,
      name: this.nameValue,
      allTeamsJson: this.allTeamsJsonValue,
      sharedTeamsJson: this.sharedTeamsJsonValue
    }

    if (this.isModalRoot) {
      this.openWith(data)
      return
    }

    const modalController = this.modalController()
    if (modalController) modalController.openWith(data)
  }

  openWith({ id, name, allTeamsJson, sharedTeamsJson }) {
    if (this.hasRecordIdTarget) this.recordIdTarget.value = id || ""
    if (this.hasUnshareRecordIdTarget) this.unshareRecordIdTarget.value = id || ""
    if (this.hasTitleTarget) {
      this.titleTarget.textContent = name
        ? `Share ${this.entityLabel}: ${name}`
        : `Share ${this.entityLabel}`
    }
    if (this.hasUnshareTeamIdTarget) this.unshareTeamIdTarget.value = ""
    this.selectedSharedTeamId = null

    this.rebuildTeamDropdown(allTeamsJson, sharedTeamsJson)
    this.toggleSubmit()
    this.renderSharedTeamsFromJson(sharedTeamsJson)
  }

  modalController() {
    const modal = document.getElementById(this.modalElementId)
    if (!modal) return null

    return this.application.getControllerForElementAndIdentifier(modal, this.identifier)
  }

  toggleSubmit() {
    if (!this.hasSubmitButtonTarget || !this.hasTeamSelectTarget) return
    this.submitButtonTarget.disabled = !this.teamSelectTarget.value
  }

  toggleUnshareSubmit() {
    if (!this.hasUnshareButtonTarget) return
    this.unshareButtonTarget.disabled = !this.selectedSharedTeamId
    if (this.hasUnshareTeamIdTarget) {
      this.unshareTeamIdTarget.value = this.selectedSharedTeamId
        ? String(this.selectedSharedTeamId)
        : ""
    }
  }

  renderSharedTeamsFromJson(rawJson) {
    if (!this.hasSharedListTarget) return

    const teams = parseTeamsJson(rawJson)
    this.sharedListTarget.innerHTML = ""

    if (teams.length === 0) {
      this.sharedListTarget.innerHTML =
        '<p class="text-muted mb-0">Not shared with any teams yet.</p>'
      this.toggleUnshareSubmit()
      return
    }

    teams.forEach((team) => {
      const item = document.createElement("button")
      item.type = "button"
      item.className =
        "list-group-item list-group-item-action list-group-item-success"
      item.textContent = team.name || `Team ${team.id}`
      item.dataset.teamId = team.id
      item.addEventListener("click", (e) => this.toggleRailsSharedSelect(e, team))
      this.sharedListTarget.appendChild(item)
    })

    this.toggleUnshareSubmit()
  }

  toggleRailsSharedSelect(e, team) {
    const teamId = String(team.id)

    deactivateListItem(this.sharedListTarget, this.selectedSharedTeamId)

    if (String(this.selectedSharedTeamId) === teamId) {
      this.selectedSharedTeamId = null
    } else {
      this.selectedSharedTeamId = team.id
      const el = e.currentTarget || e.target
      el.classList.add("active")
    }

    this.toggleUnshareSubmit()
  }

  rebuildTeamDropdown(allTeamsJson, sharedTeamsJson) {
    if (!this.hasTeamSelectTarget) return

    const allTeams = parseTeamsJson(allTeamsJson)
    const sharedTeams = parseTeamsJson(sharedTeamsJson)
    const shareableTeams = unsharedTeams(allTeams, sharedTeams)

    this.teamSelectTarget.innerHTML = '<option value="">Select a team...</option>'

    if (shareableTeams.length === 0) {
      const option = document.createElement("option")
      option.value = ""
      option.text = "No other teams to share with"
      this.teamSelectTarget.appendChild(option)
      this.teamSelectTarget.disabled = true
    } else {
      shareableTeams.forEach((team) => {
        const option = document.createElement("option")
        option.value = team.id
        option.text = team.name
        this.teamSelectTarget.appendChild(option)
      })
      this.teamSelectTarget.disabled = false
    }

    this.teamSelectTarget.value = ""
  }
}
