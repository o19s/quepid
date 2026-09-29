import { Controller } from "@hotwired/stimulus"
import {
  createBsTooltip,
  disposeBsTooltip,
  updateBsTooltipContent
} from "utils/bs_tooltip"

/** BS5 tooltip for Rails/Stimulus pages and migrated core case tooltips. Template-backed popovers on core still use the legacy template directive. */
export default class extends Controller {
  static values = {
    title: String,
    placement: { type: String, default: "top" },
    html: { type: Boolean, default: false },
    delay: Number
  }

  connect() {
    this.instance = createBsTooltip(this.element, {
      title: this.titleValue,
      placement: this.placementValue,
      html: this.htmlValue,
      delayMs: this.delayValue
    })
  }

  titleValueChanged(value) {
    updateBsTooltipContent(this.instance, value)
  }

  disconnect() {
    disposeBsTooltip(this.instance)
    this.instance = null
  }
}
