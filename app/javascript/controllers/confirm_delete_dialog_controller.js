import { Controller } from "@hotwired/stimulus"
import { getOrCreateBsModal } from "utils/bs_modal"
import { submitDestructiveForm } from "utils/destructive_form"

// One owner for the shared confirmation modal and its pending request.
export default class extends Controller {
  static targets = ["message"]

  open(request) {
    this.messageTarget.textContent = request.message
    this.modal = getOrCreateBsModal(this.element)
    if (this.modal) {
      this.request = request
      this.modal.show()
    } else if (window.confirm(request.message)) {
      submitDestructiveForm(request.url, request.method)
    }
  }

  confirm(event) {
    event.preventDefault()
    if (!this.request) return
    const { url, method } = this.request
    this.clear()
    submitDestructiveForm(url, method)
    this.modal.hide()
  }

  clear() {
    this.request = null
  }

  transition(event) {
    this.transitionEnd = {
      "show.bs.modal": "shown.bs.modal",
      "hide.bs.modal": "hidden.bs.modal"
    }[event.type]
  }

  disconnect() {
    this.clear()
    const modal = this.modal
    if (!modal) return
    const detached = !this.element.isConnected
    const dispose = () => {
      modal.dispose()
      // A pending Bootstrap show callback can reattach a removed modal.
      if (detached) this.element.remove()
    }
    // Bootstrap's queued animation callbacks still need the instance intact.
    if (this.transitionEnd) this.element.addEventListener(this.transitionEnd, dispose, { once: true })
    else dispose()
    this.modal = null
  }
}
