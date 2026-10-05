import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static outlets = ["confirm-delete-dialog"]
  static values = {
    url: String,
    method: { type: String, default: "delete" },
    message: { type: String, default: "Are you sure?" }
  }

  open(event) {
    event.preventDefault()
    this.confirmDeleteDialogOutlet.open({
      url: this.urlValue,
      method: this.methodValue,
      message: this.messageValue
    })
  }
}
