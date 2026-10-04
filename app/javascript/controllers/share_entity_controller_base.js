import { Controller } from "@hotwired/stimulus"
import {
  deactivateListItem,
  parseTeamsJson,
  unsharedTeams
} from "utils/share_case_teams"
import { isSameId } from "utils/record_identity"

/**
 * Shared base for the "share/unshare on an index page + team page" pattern used by
 * share-case/share-book/share-scorer/share-search-endpoint: `<select>` + two form
 * POSTs + redirect.
 *
 * The controller lives only on the modal element, which declares
 * `show.bs.modal-><identifier>#open`. Each row's share button is a plain
 * `data-bs-toggle="modal"` trigger carrying `data-<identifier>-id-value`,
 * `-name-value`, `-all-teams-json-value`, and `-shared-teams-json-value`.
 * Bootstrap passes the clicked button as `event.relatedTarget`, and `open`
 * reads those attributes off it.
 *
 * A concrete controller only needs to supply `entityLabel`.
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

  connect() {
    this.selectedSharedTeamId = null
  }

  open(event) {
    // show.bs.modal bubbles; ignore it when it comes from a nested modal.
    if (event.target !== this.element) return

    const trigger = event.relatedTarget
    const read = (name) => trigger?.getAttribute?.(`data-${this.identifier}-${name}-value`) ?? ""
    this.openWith({
      id: read("id"),
      name: read("name"),
      allTeamsJson: read("all-teams-json"),
      sharedTeamsJson: read("shared-teams-json")
    })
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
    this.renderedSharedTeams = teams
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
      item.setAttribute(`data-${this.identifier}-team-id-param`, String(team.id))
      item.dataset.action = `click->${this.identifier}#selectSharedTeam`
      this.sharedListTarget.appendChild(item)
    })

    this.toggleUnshareSubmit()
  }

  selectSharedTeam(event) {
    const team = this.renderedSharedTeams.find(team => isSameId(team.id, event.params.teamId))
    if (team) this.toggleRailsSharedSelect(event, team)
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
