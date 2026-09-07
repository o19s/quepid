import { Controller } from "@hotwired/stimulus"
import { attachTextPaste } from "utils/text_paste"

/** Dispatches text-paste:paste with { pastedText } in detail. */
export default class extends Controller {
  connect() {
    this.detach = attachTextPaste(this.element, pastedText => {
      this.dispatch("paste", { detail: { pastedText } })
    })
  }

  disconnect() {
    this.detach?.()
    this.detach = null
  }
}
