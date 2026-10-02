import CoreModalControllerBase from "controllers/core_modal_controller_base"
import { apiFetch } from "api/fetch"
import { getOrCreateBsModal, showBsModal } from "utils/bs_modal"
import {
  deactivateListItem,
  parseTeamsJson,
  partitionTeams,
  unsharedTeams
} from "utils/share_case_teams"
import { caseNameFromHeader } from "utils/case_header"

/**
 * Share / unshare from the core case toolbar — list UI, API stay-on-page.
 */
export default class extends CoreModalControllerBase {
  static targets = [
    "alert",
    "loading",
    "bodyContent",
    "emptyShareable",
    "sharePicker",
    "shareableList",
    "sharedSection",
    "sharedList",
    "caseId",
    "unshareCaseId",
    "teamId",
    "unshareTeamId",
    "title",
    "submitButton",
    "unshareButton"
  ]

  static values = {
    teamsUrl: String,
    teamCasesUrlTemplate: String,
    teamCaseUrlTemplate: String
  }

  connect() {
    this.selectedShareTeamId = null
    this.selectedShareTeamName = null
    this.selectedSharedTeamId = null
    this.selectedSharedTeamName = null
    this.currentCaseId = null
    this.allTeams = []
    this.sharedTeams = []
  }

  async openFor(btn) {
    const caseId = btn?.dataset?.shareCaseCoreIdValue
    const caseName = caseNameFromHeader()

    if (this.hasCaseIdTarget) this.caseIdTarget.value = caseId || ""
    if (this.hasUnshareCaseIdTarget) this.unshareCaseIdTarget.value = caseId || ""
    if (this.hasTitleTarget) {
      this.titleTarget.textContent = caseName ? `Share Case: ${caseName}` : "Share Case"
    }

    this.currentCaseId = caseId || ""
    this.clearSelections()
    this.clearAlert()

    if (this.hasTeamsUrlValue && this.teamsUrlValue) {
      await this.loadTeamsFromApi(this.currentCaseId)
    } else {
      const sharedTeamsJson = btn?.dataset?.shareCaseCoreSharedTeamsJson
      const allTeamsJson = btn?.dataset?.shareCaseCoreAllTeamsJson
      this.applyTeamLists(
        parseTeamsJson(allTeamsJson),
        parseTeamsJson(sharedTeamsJson)
      )
    }
  }

  // Opened by another modal (judgements) rather than a toolbar link, so
  // there is no real trigger. Hand Bootstrap a stand-in carrying the case id.
  openFromExternal(event) {
    const detail = event.detail || {}
    showBsModal(getOrCreateBsModal(this.element), {
      dataset: { shareCaseCoreIdValue: String(detail.caseNo ?? "") }
    })
  }

  clearSelections() {
    this.selectedShareTeamId = null
    this.selectedShareTeamName = null
    this.selectedSharedTeamId = null
    this.selectedSharedTeamName = null
    if (this.hasTeamIdTarget) this.teamIdTarget.value = ""
    if (this.hasUnshareTeamIdTarget) this.unshareTeamIdTarget.value = ""
    this.updateShareFooter()
    this.updateUnshareFooter()
  }

  clearSharedSelection() {
    if (this.hasSharedListTarget) {
      deactivateListItem(this.sharedListTarget, this.selectedSharedTeamId)
    }
    this.selectedSharedTeamId = null
    this.selectedSharedTeamName = null
    if (this.hasUnshareTeamIdTarget) this.unshareTeamIdTarget.value = ""
    this.updateUnshareFooter()
  }

  clearShareSelection() {
    if (this.hasShareableListTarget) {
      deactivateListItem(this.shareableListTarget, this.selectedShareTeamId)
    }
    this.selectedShareTeamId = null
    this.selectedShareTeamName = null
    if (this.hasTeamIdTarget) this.teamIdTarget.value = ""
    this.updateShareFooter()
  }

  updateShareFooter() {
    if (!this.hasSubmitButtonTarget) return
    if (this.selectedShareTeamId) {
      this.submitButtonTarget.classList.remove("d-none")
      this.submitButtonTarget.textContent = `Share with ${this.selectedShareTeamName}`
      this.submitButtonTarget.disabled = false
    } else {
      this.submitButtonTarget.classList.add("d-none")
      this.submitButtonTarget.disabled = true
    }
  }

  updateUnshareFooter() {
    if (!this.hasUnshareButtonTarget) return
    if (this.selectedSharedTeamId) {
      this.unshareButtonTarget.classList.remove("d-none")
      this.unshareButtonTarget.textContent = `Unshare from ${this.selectedSharedTeamName}`
      this.unshareButtonTarget.disabled = false
      if (this.hasUnshareTeamIdTarget) {
        this.unshareTeamIdTarget.value = String(this.selectedSharedTeamId)
      }
    } else {
      this.unshareButtonTarget.classList.add("d-none")
      this.unshareButtonTarget.disabled = true
      if (this.hasUnshareTeamIdTarget) this.unshareTeamIdTarget.value = ""
    }
  }

  renderShareableTeams(teams) {
    if (!this.hasShareableListTarget) return

    this.shareableTeams = teams
    this.renderTeamList(this.shareableListTarget, teams, {
      className: "list-group-item list-group-item-action",
      action: "selectShareTeam"
    })
  }

  toggleShareSelect(e, team) {
    if (this.hasShareableListTarget) {
      deactivateListItem(this.shareableListTarget, this.selectedShareTeamId)
    }

    if (String(this.selectedShareTeamId) === String(team.id)) {
      this.clearShareSelection()
    } else {
      this.clearSharedSelection()
      this.selectedShareTeamId = team.id
      this.selectedShareTeamName = team.name || `Team ${team.id}`
      if (this.hasTeamIdTarget) this.teamIdTarget.value = String(team.id)
      const el = e.currentTarget || e.target
      el.classList.add("active")
      this.updateShareFooter()
    }
  }

  renderSharedTeams(teams) {
    if (!this.hasSharedListTarget) return

    this.renderedSharedTeams = teams
    this.renderTeamList(this.sharedListTarget, teams, {
      className: "list-group-item list-group-item-action list-group-item-success",
      action: "selectSharedTeam"
    })

    this.updateUnshareFooter()
  }

  selectShareTeam(event) {
    const team = this.shareableTeams.find(team => String(team.id) === String(event.params.teamId))
    if (team) this.toggleShareSelect(event, team)
  }

  selectSharedTeam(event) {
    const team = this.renderedSharedTeams.find(team => String(team.id) === String(event.params.teamId))
    if (team) this.toggleCoreSharedSelect(event, team)
  }

  renderTeamList(target, teams, { className, action }) {
    target.innerHTML = ""

    teams.forEach((team) => {
      const item = document.createElement("button")
      item.type = "button"
      item.className = className
      item.textContent = team.name || `Team ${team.id}`
      item.dataset.teamId = team.id
      item.dataset.shareCaseCoreTeamIdParam = String(team.id)
      item.dataset.action = `click->share-case-core#${action}`
      target.appendChild(item)
    })
  }

  toggleCoreSharedSelect(e, team) {
    if (this.hasSharedListTarget) {
      deactivateListItem(this.sharedListTarget, this.selectedSharedTeamId)
    }

    if (String(this.selectedSharedTeamId) === String(team.id)) {
      this.clearSharedSelection()
    } else {
      this.clearShareSelection()
      this.selectedSharedTeamId = team.id
      this.selectedSharedTeamName = team.name || `Team ${team.id}`
      const el = e.currentTarget || e.target
      el.classList.add("active")
      this.updateUnshareFooter()
    }
  }

  applyShareableAndSharedUi(shareableTeams, sharedTeams, allTeams) {
    const hasShareable = shareableTeams.length > 0
    const hasShared = sharedTeams.length > 0
    const hasNoTeams = allTeams.length === 0

    if (this.hasEmptyShareableTarget) {
      // A team that already has this case is not shareable again, but it
      // still means the user has a team. Reserve this empty state for users
      // with no teams at all.
      this.emptyShareableTarget.classList.toggle("d-none", !hasNoTeams)
    }
    if (this.hasSharePickerTarget) {
      this.sharePickerTarget.classList.toggle("d-none", !hasShareable)
    }
    if (this.hasSharedSectionTarget) {
      this.sharedSectionTarget.classList.toggle("d-none", !hasShared)
    }

    if (!hasShareable) this.clearShareSelection()
    if (!hasShared) this.clearSharedSelection()
  }

  rebuildShareableList(allTeams, sharedTeams) {
    const shareableTeams = unsharedTeams(allTeams, sharedTeams)

    this.renderShareableTeams(shareableTeams)
    this.applyShareableAndSharedUi(shareableTeams, sharedTeams, allTeams)
  }

  async loadTeamsFromApi(caseId) {
    this.setLoading(true)
    try {
      const response = await apiFetch(this.teamsUrlValue, {
        headers: { Accept: "application/json" }
      })
      if (!response.ok) {
        throw new Error(`Failed to load teams (${response.status})`)
      }
      const data = await response.json()
      // Bail if the case changed while this request was in flight (e.g. the
      // modal was reopened for a different case) — an outdated response must
      // not clobber the now-current case's share UI.
      if (caseId !== this.currentCaseId) return
      const teams = Array.isArray(data.teams) ? data.teams : []
      const { allTeams, sharedTeams } = partitionTeams(teams, caseId)
      this.applyTeamLists(allTeams, sharedTeams)
    } catch (error) {
      if (caseId !== this.currentCaseId) return
      console.error("share-case-core: load teams failed", error)
      this.showAlert("Unable to load teams. Please try again.", "danger")
      this.resetTeamListsForError()
    } finally {
      if (caseId === this.currentCaseId) this.setLoading(false)
    }
  }

  // Same end state as applyTeamLists([], []) — empty picker/shared section,
  // selections cleared — except the "no teams" placeholder must stay hidden
  // here: this is a load failure, not a user with zero teams.
  resetTeamListsForError() {
    this.applyTeamLists([], [])
    if (this.hasEmptyShareableTarget) {
      this.emptyShareableTarget.classList.add("d-none")
    }
  }

  applyTeamLists(allTeams, sharedTeams) {
    this.allTeams = allTeams
    this.sharedTeams = sharedTeams
    this.rebuildShareableList(allTeams, sharedTeams)
    this.renderSharedTeams(sharedTeams)
  }

  async submitShare(event) {
    event.preventDefault()

    const teamId =
      this.selectedShareTeamId ||
      (this.hasTeamIdTarget ? this.teamIdTarget.value : null)
    const caseId =
      this.currentCaseId ||
      (this.hasCaseIdTarget ? this.caseIdTarget.value : null)
    if (!teamId || !caseId) return

    this.setSubmitting(true)
    this.clearAlert()

    try {
      const url = this.teamCasesUrlTemplateValue.replaceAll("__TEAM_ID__", teamId)
      const response = await apiFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ id: Number(caseId) })
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || data.message || response.statusText)
      }

      const team = this.allTeams.find((t) => String(t.id) === String(teamId)) || {
        id: Number(teamId),
        name: this.selectedShareTeamName || `Team ${teamId}`
      }
      this.sharedTeams = [...this.sharedTeams, team]
      this.clearShareSelection()
      this.applyTeamLists(this.allTeams, this.sharedTeams)
      this.dispatchCaseTeamChanged("added", caseId, team)
      this.showAlert("Case shared with team successfully.", "success")
    } catch (error) {
      console.error("share-case-core: share failed", error)
      this.showAlert(error.message || "Unable to share case with team.", "danger")
    } finally {
      this.setSubmitting(false)
    }
  }

  async submitUnshare(event) {
    event.preventDefault()

    const teamId =
      this.selectedSharedTeamId ||
      (this.hasUnshareTeamIdTarget ? this.unshareTeamIdTarget.value : null)
    const caseId =
      this.currentCaseId ||
      (this.hasUnshareCaseIdTarget ? this.unshareCaseIdTarget.value : null)
    if (!teamId || !caseId) return

    this.setSubmitting(true)
    this.clearAlert()

    try {
      const url = this.teamCaseUrlTemplateValue
        .replaceAll("__TEAM_ID__", teamId)
        .replaceAll("__CASE_ID__", caseId)
      const response = await apiFetch(url, {
        method: "DELETE",
        headers: { Accept: "application/json" }
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || data.message || response.statusText)
      }

      const team =
        this.sharedTeams.find((t) => String(t.id) === String(teamId)) || {
          id: Number(teamId),
          name: this.selectedSharedTeamName || `Team ${teamId}`
        }
      this.sharedTeams = this.sharedTeams.filter(
        (t) => String(t.id) !== String(teamId)
      )
      this.clearSharedSelection()
      this.applyTeamLists(this.allTeams, this.sharedTeams)
      this.dispatchCaseTeamChanged("removed", caseId, team)
      this.showAlert("Case unshared from team successfully.", "success")
    } catch (error) {
      console.error("share-case-core: unshare failed", error)
      this.showAlert(error.message || "Unable to unshare case from team.", "danger")
    } finally {
      this.setSubmitting(false)
    }
  }

  dispatchCaseTeamChanged(action, caseNo, team) {
    document.dispatchEvent(
      new CustomEvent("quepid:case-team-changed", {
        detail: {
          action,
          caseNo: Number(caseNo),
          team: { id: team.id, name: team.name }
        }
      })
    )
  }

  setLoading(isLoading) {
    if (this.hasLoadingTarget) {
      this.loadingTarget.classList.toggle("d-none", !isLoading)
    }
    if (this.hasBodyContentTarget) {
      this.bodyContentTarget.classList.toggle("d-none", isLoading)
    }
  }

  setSubmitting(isSubmitting) {
    if (this.hasSubmitButtonTarget) {
      this.submitButtonTarget.disabled =
        isSubmitting || !this.selectedShareTeamId
    }
    if (this.hasUnshareButtonTarget) {
      this.unshareButtonTarget.disabled =
        isSubmitting || !this.selectedSharedTeamId
    }
  }
}
