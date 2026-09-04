import { Controller } from "@hotwired/stimulus"
import { parseTeamsJson } from "utils/share_case_teams"

/**
 * Share / unshare on cases index and teams — `<select>`, form POST, redirect.
 */
export default class extends Controller {
  static targets = [
    "caseId",
    "unshareCaseId",
    "unshareTeamId",
    "teamSelect",
    "title",
    "submitButton",
    "unshareButton",
    "sharedList"
  ]

  connect() {
    if (!this.isModalRoot) return
    this.selectedSharedTeamId = null
  }

  get isModalRoot() {
    return this.hasTitleTarget
  }

  open(event) {
    event?.preventDefault?.()

    if (!this.isModalRoot) {
      const modalController = this.modalController()
      if (modalController) return modalController.open(event)
      return
    }

    const btn = event.currentTarget || event.target
    const caseId = btn?.dataset?.shareCaseIdValue
    const caseName = btn?.dataset?.shareCaseNameValue
    const sharedTeamsJson = btn?.dataset?.shareCaseSharedTeamsJson
    const allTeamsJson = btn?.dataset?.shareCaseAllTeamsJson

    if (this.hasCaseIdTarget) this.caseIdTarget.value = caseId || ""
    if (this.hasUnshareCaseIdTarget) this.unshareCaseIdTarget.value = caseId || ""
    if (this.hasTitleTarget) {
      this.titleTarget.textContent = caseName ? `Share Case: ${caseName}` : "Share Case"
    }
    if (this.hasUnshareTeamIdTarget) this.unshareTeamIdTarget.value = ""
    this.selectedSharedTeamId = null

    this.rebuildTeamDropdown(allTeamsJson, sharedTeamsJson)
    this.toggleSubmit()
    this.renderSharedTeamsFromJson(sharedTeamsJson)
  }

  modalController() {
    const modal = document.getElementById("shareCaseModal")
    if (!modal) return null

    return this.application.getControllerForElementAndIdentifier(modal, "share-case")
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

    if (this.selectedSharedTeamId) {
      const prev = this.sharedListTarget.querySelector(
        `[data-team-id="${this.selectedSharedTeamId}"]`
      )
      if (prev) prev.classList.remove("active")
    }

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
    const sharedTeamIds = sharedTeams.map((t) => String(t.id))
    const unsharedTeams = allTeams.filter(
      (team) => !sharedTeamIds.includes(String(team.id))
    )

    this.teamSelectTarget.innerHTML = '<option value="">Select a team...</option>'

    if (unsharedTeams.length === 0) {
      const option = document.createElement("option")
      option.value = ""
      option.text = "No other teams to share with"
      this.teamSelectTarget.appendChild(option)
      this.teamSelectTarget.disabled = true
    } else {
      unsharedTeams.forEach((team) => {
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
