import ModalTriggerControllerBase from "controllers/core_modal_trigger_controller_base"
import { getOrCreateBsModal, hideBsModal } from "utils/bs_modal"
import { searchEngineDisplayName } from "utils/search_engine_name"
import { supportsLookupById } from "utils/search_engines"

/**
 * Take-snapshot modal for the core case toolbar. Collects name + optional
 * document-fields checkbox, then dispatches `take-snapshot:create` so the
 * Stimulus snapshot bridge can build the payload from live query results.
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
    this.supportsLookup = supportsLookupById(searchEngine)

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

    // Engines without id lookup always store document fields.
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
    // Cancel is disabled while the snapshot request is in flight, so a stale
    // completion handler cannot fire against a modal the user has dismissed
    // and possibly reopened.
    if (this.hasCancelButtonTarget) this.cancelButtonTarget.disabled = isSubmitting
  }

  showAlert(message, variant) {
    super.showAlert(message, variant)
    if (!this.hasAlertTarget) return
    this.alertTarget.classList.add("text-danger", "mb-0")
    // Preserve newlines in the error message.
    this.alertTarget.style.whiteSpace = "pre-line"
  }

  clearAlert() {
    super.clearAlert()
    if (!this.hasAlertTarget) return
    this.alertTarget.style.whiteSpace = ""
  }
}
