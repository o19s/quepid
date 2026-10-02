import CoreModalControllerBase from "controllers/core_modal_controller_base"
import { submitDestructiveForm } from "utils/destructive_form"
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
 * Delete/archive options for the core case toolbar — list UI, form-post
 * (stay-Rails) transport, mirrors the former delete-case-options modal.
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
    const caseId = btn?.dataset?.deleteCaseOptionsCoreIdValue
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

  confirm() {
    if (!this.selectedAction || !this.currentCaseId) return

    const template = this._urlTemplateFor(this.selectedAction)
    if (!template) return

    const url = template.replaceAll("__CASE_ID__", this.currentCaseId)
    submitDestructiveForm(url, ACTION_METHODS[this.selectedAction])
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
      this.submitButtonTarget.disabled = !this.selectedAction
      this.submitButtonTarget.textContent = ACTION_LABELS[this.selectedAction] || "Delete"
    }
  }
}
