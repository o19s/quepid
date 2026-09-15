import { Controller } from "@hotwired/stimulus"
import { createBsPopover } from "utils/bs_popover"

/** BS5 text popover for Rails/Stimulus pages. Template-content popovers (ratings, match detail) still use Angular quepid-popover-template. */
export default class extends Controller {
  static values = {
    title: String,
    content: String,
    trigger: { type: String, default: "click" },
    placement: { type: String, default: "top" },
    html: { type: Boolean, default: false },
    delay: Number
  }

  connect() {
    this.handle = createBsPopover(this.element, {
      mode: "text",
      trigger: this.triggerValue,
      placement: this.placementValue,
      delayMs: this.delayValue,
      title: this.titleValue,
      body: this.contentValue,
      html: this.htmlValue
    })
  }

  titleValueChanged(value) {
    if (this.handle) this.handle.setTitle(value)
  }

  contentValueChanged(value) {
    if (this.handle) this.handle.setBody(value)
  }

  disconnect() {
    if (this.handle) this.handle.dispose()
    this.handle = null
  }
}
