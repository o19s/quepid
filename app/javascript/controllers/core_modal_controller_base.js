import { Controller } from "@hotwired/stimulus"
import { showStatusMessage } from "utils/status_message"

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
