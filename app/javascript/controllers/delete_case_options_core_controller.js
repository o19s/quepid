import { Controller } from "@hotwired/stimulus"
import { submitDestructiveForm } from "utils/destructive_form"

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
 * (stay-Rails) transport, mirrors the AngularJS delete-case-options modal.
 *
 * One controller class instantiated on both the toolbar trigger and the
 * modal root (same dual-role pattern as share-case-core): the trigger reads
 * case id/name off its own dataset and delegates to the modal-root instance.
 */
export default class extends Controller {
  static targets = [ "title", "optionButton", "description", "submitButton" ]

  static values = {
    archiveUrlTemplate: String,
    destroyUrlTemplate: String,
    destroyQueriesUrlTemplate: String
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
    const caseId = btn?.dataset?.deleteCaseOptionsCoreIdValue
    const caseName = btn?.dataset?.deleteCaseOptionsCoreNameValue

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
    if (!this.selectedAction) return

    const template = this._urlTemplateFor(this.selectedAction)
    if (!template) return

    const url = template.replaceAll("__CASE_ID__", this.currentCaseId)
    submitDestructiveForm(url, ACTION_METHODS[this.selectedAction])
  }

  modalController() {
    const modal = document.getElementById("deleteCaseOptionsModal")
    if (!modal) return null

    return this.application.getControllerForElementAndIdentifier(
      modal,
      "delete-case-options-core"
    )
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
