import { Controller } from "@hotwired/stimulus"
import { isImageUrl, queryStateClass } from "utils/query_state"

/**
 * Read-only query-row presentation. The Angular search-results directive still
 * owns the expanded row and its controls; this controller owns only the static
 * header values so the row can be migrated incrementally.
 */
export default class extends Controller {
  static targets = ["query", "text", "image", "resultCount", "resultLabel", "querqy", "header", "toggle"]
  static values = {
    informationNeed: String,
    numFound: Number,
    querqyTriggered: Boolean,
    queryText: String,
    state: String,
    diff: Boolean,
    toggled: Boolean,
    sorting: Boolean
  }

  connect() {
    this.render()
  }

  informationNeedValueChanged() {
    this.render()
  }

  numFoundValueChanged() {
    this.render()
  }

  querqyTriggeredValueChanged() {
    this.render()
  }

  queryTextValueChanged() {
    this.render()
  }

  diffValueChanged() {
    this.render()
  }

  toggledValueChanged() {
    this.render()
  }

  sortingValueChanged() {
    this.render()
  }

  stateValueChanged(value, previousValue) {
    if (previousValue) this.element.classList.remove(queryStateClass(previousValue))
    if (value) this.element.classList.add(queryStateClass(value))
  }

  render() {
    if (this.hasStateValue) this.stateValueChanged(this.stateValue)
    if (this.hasQueryTarget) {
      this.queryTarget.setAttribute("data-bs-tooltip-title-value", `Info Need: ${this.informationNeedValue}`)
    }
    if (this.hasTextTarget) this.textTarget.textContent = `${this.queryTextValue}\u00a0`
    if (this.hasImageTarget) {
      const image = isImageUrl(this.queryTextValue)
      this.imageTarget.classList.toggle("d-none", !image)
      this.imageTarget.toggleAttribute("aria-hidden", !image)
      if (image) this.imageTarget.src = this.queryTextValue
    }
    if (this.hasTextTarget) this.textTarget.classList.toggle("d-none", isImageUrl(this.queryTextValue))
    if (this.hasResultCountTarget) {
      this.resultCountTarget.setAttribute("data-count-up-number-value", String(this.numFoundValue || 0))
    }
    if (this.hasResultLabelTarget) {
      this.resultLabelTarget.textContent = this.numFoundValue === 1 ? "Result" : "Results"
    }
    if (this.hasQuerqyTarget) this.querqyTarget.classList.toggle("d-none", !this.querqyTriggeredValue)
    if (this.hasHeaderTarget) this.headerTarget.classList.toggle("diff-query-display", this.diffValue)
    if (this.hasToggleTarget) {
      this.toggleTarget.classList.toggle("bi-caret-up-fill", this.toggledValue)
      this.toggleTarget.classList.toggle("bi-caret-down-fill", !this.toggledValue)
      this.toggleTarget.classList.toggle("d-none", this.sortingValue)
    }
  }
}
