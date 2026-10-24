import { Controller } from "@hotwired/stimulus"

// Prepare Bootstrap's transient DOM before Turbo clones the page for history.
export default class extends Controller {
  prepare() {
    this.element.querySelectorAll(".modal.show").forEach(modal => {
      window.bootstrap.Modal.getInstance(modal)?.hide()
      modal.classList.remove("show")
      modal.style.display = "none"
      modal.setAttribute("aria-hidden", "true")
      modal.removeAttribute("aria-modal")
      modal.removeAttribute("role")
    })
    this.element.querySelectorAll(".dropdown-toggle").forEach(toggle => {
      window.bootstrap.Dropdown.getInstance(toggle)?.hide()
    })
    this.element.querySelectorAll(".tooltip, .popover, .modal-backdrop").forEach(node => node.remove())
    this.element.classList.remove("modal-open")
    this.element.style.removeProperty("overflow")
    this.element.style.removeProperty("padding-right")
  }
}
