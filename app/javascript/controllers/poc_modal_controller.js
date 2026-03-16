import { Controller } from "@hotwired/stimulus"

// POC: Demonstrates AngularJS → Stimulus modal communication via CustomEvents.
// AngularJS dispatches 'open-poc-modal' with data, Stimulus opens a Bootstrap modal,
// user edits data, and on save Stimulus dispatches 'poc-modal-saved' back.
//
// Note: core.html.erb uses Bootstrap 3 CSS but Bootstrap 5 JS (via importmaps).
// BS5 JS adds the 'show' class, but BS3 CSS expects the 'in' class for visibility.
// We bridge this by manually managing display and classes.
export default class extends Controller {
  static targets = ["title", "nameInput", "colorSelect", "result"]

  connect() {
    this.handleOpen = this.openFromEvent.bind(this)
    window.addEventListener("open-poc-modal", this.handleOpen)
  }

  disconnect() {
    window.removeEventListener("open-poc-modal", this.handleOpen)
  }

  openFromEvent(event) {
    this.originalData = event.detail
    this.titleTarget.textContent = `Edit: ${event.detail.name}`
    this.nameInputTarget.value = event.detail.name
    this.colorSelectTarget.value = event.detail.color
    this.resultTarget.style.display = "none"

    // Show modal using BS3-compatible approach (no BS5 Modal JS needed)
    this.element.style.display = "block"
    this.element.classList.add("in")
    document.body.classList.add("modal-open")

    // Create backdrop
    this.backdrop = document.createElement("div")
    this.backdrop.className = "modal-backdrop fade in"
    document.body.appendChild(this.backdrop)
  }

  save() {
    const updatedData = {
      id: this.originalData.id,
      name: this.nameInputTarget.value,
      color: this.colorSelectTarget.value
    }

    // Show confirmation inside the modal
    this.resultTarget.textContent = `Saved! Dispatching back to AngularJS...`
    this.resultTarget.style.display = "block"

    // Dispatch event back to AngularJS
    window.dispatchEvent(new CustomEvent("poc-modal-saved", { detail: updatedData }))

    // Close modal after a brief delay so user sees the confirmation
    setTimeout(() => this.close(), 500)
  }

  cancel() {
    this.close()
  }

  close() {
    this.element.style.display = "none"
    this.element.classList.remove("in")
    document.body.classList.remove("modal-open")

    if (this.backdrop) {
      this.backdrop.remove()
      this.backdrop = null
    }
  }
}
