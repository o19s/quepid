import ModalTriggerControllerBase from "controllers/core_modal_trigger_controller_base"
import { getOrCreateBsModal, hideBsModal } from "utils/bs_modal"
import { searchEngineDisplayName, supportLookupById } from "utils/search_engine_name"
import { showStatusMessage } from "utils/status_message"

/**
 * Take-snapshot modal for the core case toolbar — mirrors AngularJS
 * `views/snapshotModal.html` / `PromptSnapshotCtrl`. Collects name + optional
 * document-fields checkbox, then dispatches `take-snapshot:create` so Angular
 * `querySnapshotSvc.addSnapshot` can build the payload from live
 * `queriesSvc` results until the live-query-state migration owns that path.
 *
 * Dual-role trigger/modal-root pattern via ModalTriggerControllerBase.
 */
export default class extends ModalTriggerControllerBase {
  static targets = [
    "title",
    "alert",
    "nameInput",
    "lookupFields",
    "noLookupFields",
    "fieldSpec",
    "engineName",
    "recordFieldsCheckbox",
    "submitButton",
    "progress",
    "cancelButton"
  ]

  get modalElementId() {
    return "takeSnapshotModal"
  }

  openAsRoot(event) {
    const btn = event.currentTarget || event.target
    const caseId = btn?.dataset?.takeSnapshotCoreIdValue
    const fieldSpec = btn?.dataset?.takeSnapshotCoreFieldSpecValue || ""
    const searchEngine = btn?.dataset?.takeSnapshotCoreSearchEngineValue || ""
    const mapperName = btn?.dataset?.takeSnapshotCoreMapperEngineNameValue || ""

    this.currentCaseId = caseId || ""
    this.searchEngine = searchEngine
    this.supportsLookup = supportLookupById(searchEngine)

    if (this.hasNameInputTarget) this.nameInputTarget.value = ""
    if (this.hasRecordFieldsCheckboxTarget) this.recordFieldsCheckboxTarget.checked = false
    if (this.hasFieldSpecTarget) this.fieldSpecTarget.textContent = fieldSpec
    if (this.hasEngineNameTarget) {
      this.engineNameTarget.textContent = mapperName || searchEngineDisplayName(searchEngine)
    }

    if (this.hasLookupFieldsTarget) {
      this.lookupFieldsTarget.classList.toggle("d-none", !this.supportsLookup)
    }
    if (this.hasNoLookupFieldsTarget) {
      this.noLookupFieldsTarget.classList.toggle("d-none", this.supportsLookup)
    }

    this.clearAlert()
    this.setProgress(false)
    this.setSubmitting(false)
  }

  submit(event) {
    event?.preventDefault?.()
    if (!this.currentCaseId) return

    const name = this.hasNameInputTarget ? this.nameInputTarget.value : ""
    let recordDocumentFields = this.hasRecordFieldsCheckboxTarget
      ? this.recordFieldsCheckboxTarget.checked
      : false

    // Engines without id lookup always store document fields (Angular parity).
    if (!this.supportsLookup) recordDocumentFields = true

    this.setSubmitting(true)
    this.setProgress(true)
    this.clearAlert()

    const caseId = this.currentCaseId

    document.dispatchEvent(
      new CustomEvent("take-snapshot:create", {
        detail: {
          caseId: Number(caseId),
          name,
          recordDocumentFields,
          done: (error) => {
            if (String(this.currentCaseId) !== String(caseId)) return

            this.setProgress(false)
            if (error) {
              this.showAlert(
                `An error (${error}) occurred, please try again.\nIf the error persist, contact adminstrator for further assistance.`,
                "danger"
              )
              this.setSubmitting(false)
              return
            }

            hideBsModal(getOrCreateBsModal(this.element))
            this.setSubmitting(false)
          }
        }
      })
    )
  }

  setProgress(visible) {
    if (!this.hasProgressTarget) return
    this.progressTarget.classList.toggle("d-none", !visible)
  }

  setSubmitting(isSubmitting) {
    if (this.hasSubmitButtonTarget) this.submitButtonTarget.disabled = isSubmitting
    // Angular parity: Cancel is disabled while the snapshot request is in
    // flight, so a stale request's completion handler can't fire against a
    // modal the user has since dismissed and possibly reopened.
    if (this.hasCancelButtonTarget) this.cancelButtonTarget.disabled = isSubmitting
  }

  showAlert(message, variant) {
    if (!this.hasAlertTarget) return
    showStatusMessage(this.alertTarget, {
      message,
      className: `alert alert-${variant} text-danger mb-0`
    })
    // Preserve newlines from the Angular error copy
    this.alertTarget.style.whiteSpace = "pre-line"
  }

  clearAlert() {
    if (!this.hasAlertTarget) return
    showStatusMessage(this.alertTarget, { message: "", className: "alert d-none" })
    this.alertTarget.style.whiteSpace = ""
  }
}
