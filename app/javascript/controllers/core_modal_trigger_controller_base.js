import { Controller } from "@hotwired/stimulus"

/**
 * Base for the trigger/modal-root dual-instantiation pattern shared by the
 * core case toolbar's clone-case, share-case, and delete-case-options
 * controllers: the same controller class is instantiated once on the
 * toolbar trigger button and once on the modal element itself (both carry
 * the same `data-controller` identifier). The trigger instance has no real
 * state - its `open()` looks up the modal root's live controller instance
 * via Stimulus and delegates to it; only the root instance renders UI.
 *
 * A subclass must:
 * - include "title" in its `static targets` (the modal root is the only
 *   instance that renders a title, so `hasTitleTarget` doubles as the
 *   root-vs-trigger check)
 * - implement `modalElementId` returning the DOM id of its modal element
 * - implement `openAsRoot(event)` instead of `open(event)` - only called
 *   once delegation has resolved to the modal root instance
 */
export default class extends Controller {
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

    return this.openAsRoot(event)
  }

  modalController() {
    const modal = document.getElementById(this.modalElementId)
    if (!modal) return null

    return this.application.getControllerForElementAndIdentifier(modal, this.identifier)
  }
}
