import { Controller } from "@hotwired/stimulus"
import { getOrCreateBsModal } from "utils/bs_modal"

const STYLES = ["danger", "primary"]

// The shared confirmation modal behind Turbo's data-turbo-confirm on Rails pages
// (wired in application.js). Only Confirm accepts; any other close declines.
export default class extends Controller {
  static targets = ["message", "accept"]

  // style colours the Confirm button: "danger" (default) or "primary" for
  // non-destructive actions such as unarchiving.
  ask(message, style = "danger") {
    this.settle(false)
    this.messageTarget.textContent = message
    const accepted = STYLES.includes(style) ? style : "danger"
    STYLES.forEach(name => this.acceptTarget.classList.toggle(`btn-${name}`, name === accepted))
    this.modal = getOrCreateBsModal(this.element)
    if (!this.modal) return Promise.resolve(window.confirm(message))
    return new Promise(resolve => {
      this.resolve = resolve
      this.modal.show()
    })
  }

  confirm(event) {
    event.preventDefault()
    if (!this.resolve) return
    this.settle(true)
    this.modal.hide()
  }

  clear() {
    this.settle(false)
  }

  settle(accepted) {
    const resolve = this.resolve
    this.resolve = null
    resolve?.(accepted)
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
