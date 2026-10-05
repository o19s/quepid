import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  connect() {
    this.element.style.display = "block"
  }

  close() {
    this.element.style.display = "none"
  }

  removeImage(event) {
    event.target.remove()
  }
}
