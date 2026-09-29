import { Controller } from "@hotwired/stimulus"
import { renderJsonExplorer } from "utils/json_explorer"

/**
 * Thin wrapper around utils/json_explorer for inline JSON field display in
 * searchResult.html's "Other fields" loop. Value is re-rendered on every
 * change because the source data attribute is recomputed eagerly.
 */
export default class extends Controller {
  static values = { json: String }

  connect() {
    this.render()
  }

  jsonValueChanged() {
    if (this.element.isConnected) this.render()
  }

  render() {
    renderJsonExplorer(this.element, this.jsonValue, { collapsed: false })
  }
}
