import { Controller } from "@hotwired/stimulus"
import { apiFetch } from "api/fetch"
import { parseTeamsJson, partitionTeams } from "utils/share_case_teams"

/**
 * Share / unshare from the core case toolbar — list UI, API stay-on-page.
 */
export default class extends Controller {
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
    "unshareButton",
    "shareForm",
    "unshareForm"
  ]

  static values = {
    teamsUrl: String,
    teamCasesUrlTemplate: String,
    teamCaseUrlTemplate: String
  }

  connect() {
    if (!this.isModalRoot) return

    this.selectedShareTeamId = null
    this.selectedShareTeamName = null
    this.selectedSharedTeamId = null
    this.selectedSharedTeamName = null
    this.currentCaseId = null
    this.allTeams = []
    this.sharedTeams = []
    this.boundShareSubmit = (e) => this.submitShare(e)
    this.boundUnshareSubmit = (e) => this.submitUnshare(e)
    this.boundOpenFromEvent = (e) => this.openFromExternal(e)

    if (this.hasShareFormTarget) {
      this.shareFormTarget.addEventListener("submit", this.boundShareSubmit)
    }
    if (this.hasUnshareFormTarget) {
      this.unshareFormTarget.addEventListener("submit", this.boundUnshareSubmit)
    }
    document.addEventListener("quepid:open-share-case-core", this.boundOpenFromEvent)
  }

  disconnect() {
    if (!this.isModalRoot) return

    if (this.hasShareFormTarget) {
      this.shareFormTarget.removeEventListener("submit", this.boundShareSubmit)
    }
    if (this.hasUnshareFormTarget) {
      this.unshareFormTarget.removeEventListener("submit", this.boundUnshareSubmit)
    }
    document.removeEventListener("quepid:open-share-case-core", this.boundOpenFromEvent)
  }

  get isModalRoot() {
    return this.hasTitleTarget
  }

  async open(event) {
    event?.preventDefault?.()

    if (!this.isModalRoot) {
      const modalController = this.modalController()
      if (modalController) return modalController.open(event)
      return
    }

    const btn = event.currentTarget || event.target
    const caseId = btn?.dataset?.shareCaseCoreIdValue
    const caseName = btn?.dataset?.shareCaseCoreNameValue

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

  openFromExternal(event) {
    const detail = event.detail || {}
    const bs = window.bootstrap?.Modal
    if (bs && this.element) {
      bs.getOrCreateInstance(this.element).show()
    }

    return this.open({
      preventDefault: () => {},
      currentTarget: {
        dataset: {
          shareCaseCoreIdValue: String(detail.caseNo ?? ""),
          shareCaseCoreNameValue: detail.caseName ?? ""
        }
      }
    })
  }

  modalController() {
    const modal = document.getElementById("shareCaseModal")
    if (!modal) return null

    return this.application.getControllerForElementAndIdentifier(
      modal,
      "share-case-core"
    )
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
    if (this.selectedSharedTeamId && this.hasSharedListTarget) {
      const prev = this.sharedListTarget.querySelector(
        `[data-team-id="${this.selectedSharedTeamId}"]`
      )
      if (prev) prev.classList.remove("active")
    }
    this.selectedSharedTeamId = null
    this.selectedSharedTeamName = null
    if (this.hasUnshareTeamIdTarget) this.unshareTeamIdTarget.value = ""
    this.updateUnshareFooter()
  }

  clearShareSelection() {
    if (this.selectedShareTeamId && this.hasShareableListTarget) {
      const prev = this.shareableListTarget.querySelector(
        `[data-team-id="${this.selectedShareTeamId}"]`
      )
      if (prev) prev.classList.remove("active")
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

    this.shareableListTarget.innerHTML = ""

    teams.forEach((team) => {
      const item = document.createElement("button")
      item.type = "button"
      item.className = "list-group-item list-group-item-action"
      item.textContent = team.name || `Team ${team.id}`
      item.dataset.teamId = team.id
      item.addEventListener("click", (e) => this.toggleShareSelect(e, team))
      this.shareableListTarget.appendChild(item)
    })
  }

  toggleShareSelect(e, team) {
    if (this.selectedShareTeamId && this.hasShareableListTarget) {
      const prev = this.shareableListTarget.querySelector(
        `[data-team-id="${this.selectedShareTeamId}"]`
      )
      if (prev) prev.classList.remove("active")
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

    this.sharedListTarget.innerHTML = ""

    teams.forEach((team) => {
      const item = document.createElement("button")
      item.type = "button"
      item.className =
        "list-group-item list-group-item-action list-group-item-success"
      item.textContent = team.name || `Team ${team.id}`
      item.dataset.teamId = team.id
      item.addEventListener("click", (e) => this.toggleCoreSharedSelect(e, team))
      this.sharedListTarget.appendChild(item)
    })

    this.updateUnshareFooter()
  }

  toggleCoreSharedSelect(e, team) {
    if (this.selectedSharedTeamId && this.hasSharedListTarget) {
      const prev = this.sharedListTarget.querySelector(
        `[data-team-id="${this.selectedSharedTeamId}"]`
      )
      if (prev) prev.classList.remove("active")
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

  applyShareableAndSharedUi(unsharedTeams, sharedTeams) {
    const hasShareable = unsharedTeams.length > 0
    const hasShared = sharedTeams.length > 0

    if (this.hasEmptyShareableTarget) {
      this.emptyShareableTarget.classList.toggle("d-none", hasShareable)
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
    const sharedTeamIds = sharedTeams.map((t) => String(t.id))
    const unsharedTeams = allTeams.filter(
      (team) => !sharedTeamIds.includes(String(team.id))
    )

    this.renderShareableTeams(unsharedTeams)
    this.applyShareableAndSharedUi(unsharedTeams, sharedTeams)
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
      const teams = Array.isArray(data.teams) ? data.teams : []
      const { allTeams, sharedTeams } = partitionTeams(teams, caseId)
      this.applyTeamLists(allTeams, sharedTeams)
    } catch (error) {
      console.error("share-case-core: load teams failed", error)
      this.showAlert("Unable to load teams. Please try again.", "danger")
      this.applyTeamLists([], [])
    } finally {
      this.setLoading(false)
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

      if (!response.ok && response.status !== 204) {
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

  showAlert(message, variant) {
    if (!this.hasAlertTarget) return
    this.alertTarget.textContent = message
    this.alertTarget.className = `alert alert-${variant}`
    this.alertTarget.classList.remove("d-none")
  }

  clearAlert() {
    if (!this.hasAlertTarget) return
    this.alertTarget.textContent = ""
    this.alertTarget.className = "alert d-none"
  }
}
