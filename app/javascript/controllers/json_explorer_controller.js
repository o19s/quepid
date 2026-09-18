import { Controller } from "@hotwired/stimulus"
import { renderJsonExplorer } from "utils/json_explorer"

/**
 * Thin wrapper around utils/json_explorer for inline JSON field display —
 * was `<json-explorer json-data="fieldValue" collapsed="false">` (former
 * ng-json-explorer Angular directive) in searchResult.html's "Other fields"
 * loop. Value is re-rendered on every change since the source digest-bound
 * data attribute is recomputed each Angular digest (same eager-recompute
 * tradeoff as match-explain — see docs/todo/todo.md).
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
