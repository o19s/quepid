import { Controller } from "@hotwired/stimulus"
import { copyText } from "utils/clipboard"

// Copies its text value when clicked.
export default class extends Controller {
  static values = { text: String }

  copy() {
    copyText(this.textValue).catch((error) => console.error(error))
  }
}
