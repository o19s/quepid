import { Controller } from "@hotwired/stimulus"
import { copyText } from "utils/clipboard"
import { createTemporaryFeedback } from "utils/temporary_feedback"

// Copies its text value, or its source target's text, when clicked.
//
// With a success or failure label, the clicked button briefly shows that label
// (after an optional Bootstrap icon) and then gets its original content back.
// Feedback assumes one copy button per controller. Hosts that need their own
// messaging listen for clipboard:copied, clipboard:failed and clipboard:empty.
export default class extends Controller {
  static targets = ["source"]
  static values = {
    text: String,
    successLabel: String,
    successIcon: String,
    failureLabel: String,
    failureIcon: String,
    feedbackMs: { type: Number, default: 2000 }
  }

  disconnect() {
    this.feedback?.cancel()
  }

  copy(event) {
    const button = event?.currentTarget
    const text = this.hasSourceTarget ? this.sourceTarget.textContent : this.textValue
    if (this.hasSourceTarget && !text) {
      this.dispatch("empty")
      return
    }

    copyText(text).then(
      () => {
        this.dispatch("copied")
        this.showFeedback(button, this.successIconValue, this.successLabelValue)
      },
      (error) => {
        console.error(error)
        this.dispatch("failed", { detail: { error } })
        this.showFeedback(button, this.failureIconValue, this.failureLabelValue)
      }
    )
  }

  showFeedback(button, iconClass, label) {
    if (!button || !label) return

    this.originalLabel ??= [...button.childNodes].map(node => node.cloneNode(true))
    this.feedback ??= createTemporaryFeedback(this.feedbackMsValue)
    this.feedback.show(
      () => {
        if (!iconClass) {
          button.replaceChildren(label)
          return
        }
        const icon = document.createElement("i")
        icon.className = `bi ${iconClass}`
        button.replaceChildren(icon, ` ${label}`)
      },
      () => button.replaceChildren(...this.originalLabel.map(node => node.cloneNode(true)))
    )
  }
}
