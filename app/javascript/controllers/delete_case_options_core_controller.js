import CoreModalControllerBase from "controllers/core_modal_controller_base"
import { deleteJson, postJson } from "api/json"
import coreFlash from "utils/core_flash"
import { serverMessage } from "utils/error_message"
import { caseNameFromHeader } from "utils/case_header"

const ACTION_LABELS = {
  archive: "Archive",
  destroy_case: "Delete",
  destroy_queries: "Delete All Queries"
}

const ACTION_METHODS = {
  archive: "post",
  destroy_case: "delete",
  destroy_queries: "delete"
}

/**
 * Core delete/archive options retain Rails actions and success destinations.
 * JSON submission keeps failed requests on the workspace for retry.
 *
 * The toolbar trigger carries the case id.
 */
export default class extends CoreModalControllerBase {
  static targets = [ "title", "optionButton", "description", "submitButton" ]

  static values = {
    archiveUrlTemplate: String,
    destroyUrlTemplate: String,
    destroyQueriesUrlTemplate: String
  }

  openFor(btn) {
    const caseId = this.triggerValue(btn, "id")
    const caseName = caseNameFromHeader()

    this.currentCaseId = caseId || ""
    this.titleTarget.textContent = caseName ? `Delete Options for Case: ${caseName}` : "Delete Options for Case"

    this.selectedAction = null
    this._refreshUI()
  }

  selectAction(event) {
    this.selectedAction = event.params.action
    this._refreshUI()
  }

  async confirm() {
    if (this.submitting || !this.selectedAction || !this.currentCaseId) return

    const template = this._urlTemplateFor(this.selectedAction)
    if (!template) return

    const url = template.replaceAll("__CASE_ID__", this.currentCaseId)
    const action = this.selectedAction
    this.submitting = true
    this.submitButtonTarget.disabled = true
    this.hide()
    try {
      const result = ACTION_METHODS[action] === "post" ? await postJson(url, {}) : await deleteJson(url)
      window.location.assign(result.redirect_url)
    } catch (error) {
      if (error.status === 401 && error.data?.redirect_url) {
        window.location.assign(error.data.redirect_url)
        return
      }
      coreFlash.show("error", serverMessage(error, `Could not ${ACTION_LABELS[action].toLowerCase()}. Please try again.`))
    } finally {
      this.submitting = false
      this._refreshUI()
    }
  }

  _urlTemplateFor(action) {
    switch (action) {
      case "archive":
        return this.archiveUrlTemplateValue
      case "destroy_case":
        return this.destroyUrlTemplateValue
      case "destroy_queries":
        return this.destroyQueriesUrlTemplateValue
      default:
        return null
    }
  }

  _refreshUI() {
    this.optionButtonTargets.forEach((btn) => {
      const isActive = btn.dataset.deleteCaseOptionsCoreActionParam === this.selectedAction
      btn.classList.toggle("btn-primary", isActive)
      btn.classList.toggle("btn-outline-secondary", !isActive)
    })

    this.descriptionTargets.forEach((el) => {
      el.hidden = el.dataset.forAction !== this.selectedAction
    })

    if (this.hasSubmitButtonTarget) {
      this.submitButtonTarget.disabled = this.submitting || !this.selectedAction
      this.submitButtonTarget.textContent = ACTION_LABELS[this.selectedAction] || "Delete"
    }
  }
}
