import { Controller } from "@hotwired/stimulus"
import { createBsModal, restoreModalBodyLock, showStackedModal } from "utils/bs_modal"

// One-off shells belong to the modal, rather than the result row that opened it.
// A result row may be replaced while its modal is still in use.
export default class extends Controller {
  connect() {
    if (this.modal) return
    this.onClose = () => this.close()
    this.onShown = event => {
      if (event.target !== this.element) return
      this.showing = false
      if (this.element.dynamicModalCloseRequested) this.close()
    }
    this.onHidden = event => {
      if (event.target === this.element) this.teardown()
    }
    this.element.addEventListener("dynamic-modal:close", this.onClose)
    this.element.addEventListener("shown.bs.modal", this.onShown)
    this.element.addEventListener("hidden.bs.modal", this.onHidden)
    this.modal = createBsModal(this.element, { backdrop: true, keyboard: true, focus: true })
    if (!this.modal || this.element.dynamicModalCloseRequested) {
      this.teardown()
      return
    }
    this.showing = true
    showStackedModal(this.element, this.modal)
  }

  close() {
    this.element.dynamicModalCloseRequested = true
    // Bootstrap ignores hide() during its show transition. Retry on shown.
    if (!this.showing) this.modal?.hide()
  }

  disconnect() {
    // Let Bootstrap finish its transition before disposing its instance.
    // The shown/hidden listeners remove themselves in teardown, even detached.
    if (this.modal) this.close()
  }

  teardown() {
    this.element.removeEventListener("dynamic-modal:close", this.onClose)
    this.element.removeEventListener("shown.bs.modal", this.onShown)
    this.element.removeEventListener("hidden.bs.modal", this.onHidden)
    this.modal?.dispose()
    this.modal = null
    this.element.remove()
    restoreModalBodyLock()
  }
}
