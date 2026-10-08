import { CORE_EVENTS } from "utils/core_events"
import CoreModalControllerBase from "controllers/core_modal_controller_base"
import { deleteJson, postJson } from "api/json"
import { apiFetch } from "api/fetch"
import { deactivateListItem } from "utils/share_case_teams"
import { caseNameFromHeader } from "utils/case_header"
import { isSameId } from "utils/record_identity"

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
    catalogUrlTemplate: String,
    teamCasesUrlTemplate: String,
    teamCaseUrlTemplate: String
  }

  connect() {
    this.selectedShareTeamId = null
    this.selectedShareTeamName = null
    this.selectedSharedTeamId = null
    this.selectedSharedTeamName = null
    this.currentCaseId = null
    this.teamRows = []
    this.sharedRows = []
  }

  async openFor(btn) {
    const caseId = this.triggerValue(btn, "id")
    const caseName = caseNameFromHeader()

    if (this.hasCaseIdTarget) this.caseIdTarget.value = caseId || ""
    if (this.hasUnshareCaseIdTarget) this.unshareCaseIdTarget.value = caseId || ""
    if (this.hasTitleTarget) {
      this.titleTarget.textContent = caseName ? `Share Case: ${caseName}` : "Share Case"
    }

    this.currentCaseId = caseId || ""
    this.clearSelections()
    this.clearAlert()

    await this.loadTeams(this.currentCaseId)
  }

  // Called through the judgements-core outlet rather than a toolbar link, so
  // there is no real trigger. Hand Bootstrap a stand-in carrying the case id.
  openFromExternal(caseNo) {
    this.show({
      dataset: { shareCaseCoreIdValue: String(caseNo ?? "") }
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

  toggleShareSelect(e, team) {
    if (this.hasShareableListTarget) {
      deactivateListItem(this.shareableListTarget, this.selectedShareTeamId)
    }

    if (isSameId(this.selectedShareTeamId, team.id)) {
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

  selectShareTeam(event) {
    this.toggleShareSelect(event, this.teamFor(event.currentTarget))
  }

  selectSharedTeam(event) {
    this.toggleCoreSharedSelect(event, this.teamFor(event.currentTarget))
  }

  teamFor(row) {
    return { id: Number(row.dataset.teamId), name: row.textContent }
  }

  toggleCoreSharedSelect(e, team) {
    if (this.hasSharedListTarget) {
      deactivateListItem(this.sharedListTarget, this.selectedSharedTeamId)
    }

    if (isSameId(this.selectedSharedTeamId, team.id)) {
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

  refreshSections() {
    const hasShareable = this.shareableListTarget.children.length > 0
    const hasShared = this.sharedListTarget.children.length > 0
    this.toggleVisible("emptyShareable", this.teamRows.length === 0)
    this.toggleVisible("sharePicker", hasShareable)
    this.toggleVisible("sharedSection", hasShared)
    if (!hasShareable) this.clearShareSelection()
    if (!hasShared) this.clearSharedSelection()
  }

  async loadTeams(caseId) {
    this.setLoading(true)
    try {
      const url = this.catalogUrlTemplateValue.replaceAll("__CASE_ID__", caseId)
      const response = await apiFetch(url, { headers: { Accept: "text/html" } })
      if (!response.ok || response.redirected) throw new Error("Unable to load teams")
      const html = new DOMParser().parseFromString(await response.text(), "text/html")
      const catalog = html.querySelector("[data-share-catalog]")
      if (!catalog) throw new Error("Missing team catalog")
      // Retain the established guard for responses from another case.
      if (!isSameId(caseId, this.currentCaseId)) return
      this.sharedRows = [...catalog.querySelector('[data-catalog-list="shared"]').children]
      this.teamRows = [...catalog.querySelectorAll("[data-team-id]")].sort(
        (a, b) => Number(a.dataset.teamOrder) - Number(b.dataset.teamOrder)
      )
      this.renderTeamLists()
    } catch (error) {
      if (!isSameId(caseId, this.currentCaseId)) return
      console.error("share-case-core: load teams failed", error)
      this.showAlert("Unable to load teams. Please try again.", "danger")
      this.teamRows = []
      this.sharedRows = []
      this.shareableListTarget.replaceChildren()
      this.sharedListTarget.replaceChildren()
      this.clearSelections()
      for (const target of ["emptyShareable", "sharePicker", "sharedSection"]) {
        this.toggleVisible(target, false)
      }
    } finally {
      if (isSameId(caseId, this.currentCaseId)) this.setLoading(false)
    }
  }

  renderTeamLists() {
    const sharedIds = this.sharedRows.map((row) => row.dataset.teamId)
    const shareable = this.teamRows.filter((row) => !sharedIds.includes(row.dataset.teamId))
    for (const [target, rows, shared] of [
      [this.shareableListTarget, shareable, false],
      [this.sharedListTarget, this.sharedRows, true]
    ]) {
      target.replaceChildren(...rows.map((row) => {
        const copy = row.cloneNode(true)
        copy.classList.remove("active")
        copy.classList.toggle("list-group-item-success", shared)
        copy.dataset.action = `click->share-case-core#${shared ? "selectSharedTeam" : "selectShareTeam"}`
        return copy
      }))
    }
    this.refreshSections()
    this.updateUnshareFooter()
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

    const submittedRow = this.shareableListTarget.querySelector(`[data-team-id="${teamId}"]`)
    this.setSubmitting(true)
    this.clearAlert()

    try {
      const url = this.teamCasesUrlTemplateValue.replaceAll("__TEAM_ID__", teamId)
      await postJson(url, { id: Number(caseId) })

      const row = this.teamRows.find((item) => isSameId(item.dataset.teamId, teamId))
      const team = row ? this.teamFor(row) : {
        id: Number(teamId), name: this.selectedShareTeamName || `Team ${teamId}`
      }
      // Retain append order and the previous overlapping-response semantics.
      const sharedRow = row || submittedRow?.cloneNode(true)
      if (!row && sharedRow) sharedRow.textContent = team.name
      if (sharedRow) this.sharedRows = [...this.sharedRows, sharedRow]
      this.clearShareSelection()
      this.renderTeamLists()
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
      await deleteJson(url)

      const row = this.sharedRows.find((item) => isSameId(item.dataset.teamId, teamId))
      const team = row ? this.teamFor(row) : {
        id: Number(teamId), name: this.selectedSharedTeamName || `Team ${teamId}`
      }
      this.sharedRows = this.sharedRows.filter((item) => !isSameId(item.dataset.teamId, teamId))
      this.clearSharedSelection()
      this.renderTeamLists()
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
      new CustomEvent(CORE_EVENTS.CASE_TEAM_CHANGED, {
        detail: {
          action,
          caseNo: Number(caseNo),
          team: { id: team.id, name: team.name }
        }
      })
    )
  }

  setLoading(isLoading) {
    super.setLoading(isLoading)
    this.toggleVisible("bodyContent", !isLoading)
  }

  setSubmitting(isSubmitting) {
    this.setButtonsDisabled(isSubmitting || !this.selectedShareTeamId, ["submitButton"])
    this.setButtonsDisabled(isSubmitting || !this.selectedSharedTeamId, ["unshareButton"])
  }
}
