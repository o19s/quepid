import { Controller } from "@hotwired/stimulus"
import { showStatusMessage } from "utils/status_message"
import { getOrCreateBsModal, hideBsModal, showBsModal } from "utils/bs_modal"

/**
 * Base for the core case toolbar's modals. The controller lives only on the
 * modal element. Its trigger is a plain `data-bs-toggle="modal"` link, so
 * Bootstrap opens the modal and passes the clicked trigger along as
 * `event.relatedTarget`.
 *
 * The modal element declares `show.bs.modal-><identifier>#open`. A subclass
 * implements `openFor(trigger)`, reading any per-open context (case id,
 * query id, ...) from the trigger's data attributes. `trigger` is null when
 * the modal is shown without one.
 *
 * Do not call `show()` on the modal from `openFor`: it runs inside
 * Bootstrap's own show, which is already in progress.
 *
 * Subclasses with an "alert" target get `showAlert`/`clearAlert` for free.
 */
export default class extends Controller {
  show(trigger) {
    showBsModal(getOrCreateBsModal(this.element), trigger)
  }

  hide() {
    hideBsModal(getOrCreateBsModal(this.element))
  }

  // Resolve optional targets only after checking presence: Stimulus throws
  // when reading a missing singular target.
  optionalTarget(name) {
    return this[`has${name[0].toUpperCase()}${name.slice(1)}Target`]
      ? this[`${name}Target`]
      : null
  }

  // Pass a target name for optional targets, or an element for required ones.
  toggleVisible(target, visible) {
    const element = typeof target === "string" ? this.optionalTarget(target) : target
    element?.classList.toggle("d-none", !visible)
  }

  setButtonsDisabled(disabled, names = ["submitButton", "cancelButton"]) {
    names.forEach((name) => {
      const button = this.optionalTarget(name)
      if (button) button.disabled = disabled
    })
  }

  setSubmitting(submitting) {
    this.setButtonsDisabled(submitting)
  }

  setProgress(visible) {
    this.toggleVisible("progress", visible)
  }

  setLoading(loading) {
    this.toggleVisible("loading", loading)
  }

  actionErrorMessage(message) {
    return `An error (${message}) occurred, please try again.\nIf the error persist, contact adminstrator for further assistance.`
  }

  showError(message) {
    const target = this.optionalTarget("error")
    if (!target) return
    showStatusMessage(target, { message: this.actionErrorMessage(message), className: "text-danger" })
    target.style.whiteSpace = "pre-line"
  }

  clearError() {
    showStatusMessage(this.optionalTarget("error"), { message: "", className: "text-danger d-none" })
  }

  open(event) {
    // show.bs.modal bubbles; ignore it when it comes from a nested modal.
    if (event.target !== this.element) return
    return this.openFor(event.relatedTarget || null)
  }

  showAlert(message, variant) {
    if (!this.hasAlertTarget) return
    showStatusMessage(this.alertTarget, { message, className: `alert alert-${variant}` })
  }

  clearAlert() {
    if (!this.hasAlertTarget) return
    showStatusMessage(this.alertTarget, { message: "", className: "alert d-none" })
  }
}
