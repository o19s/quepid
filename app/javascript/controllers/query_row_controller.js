import { Controller } from "@hotwired/stimulus"
import { queryStateClass } from "utils/query_state"

/**
 * Read-only query-row presentation. The Angular search-results directive still
 * owns the expanded row and its controls; this controller owns only the static
 * header values so the row can be migrated incrementally.
 */
export default class extends Controller {
  static targets = ["query", "text", "resultCount", "resultLabel", "querqy"]
  static values = {
    informationNeed: String,
    numFound: Number,
    querqyTriggered: Boolean,
    queryText: String,
    state: String
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
    if (this.hasResultCountTarget) {
      this.resultCountTarget.setAttribute("data-count-up-number-value", String(this.numFoundValue || 0))
    }
    if (this.hasResultLabelTarget) {
      this.resultLabelTarget.textContent = this.numFoundValue === 1 ? "Result" : "Results"
    }
    if (this.hasQuerqyTarget) this.querqyTarget.classList.toggle("d-none", !this.querqyTriggeredValue)
  }
}
