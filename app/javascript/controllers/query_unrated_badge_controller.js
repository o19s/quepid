import { Controller } from "@hotwired/stimulus"
import { subscribeToStore } from "utils/store_subscription"
import { isNotAllRated } from "utils/scoring"
import { getCoreStores } from "utils/core_store_access"

/**
 * Store-driven per-query "unrated results" frog badge in the expanded results.
 *
 * Reads the core store through the shared store accessors. The bundled case
 * runtime and importmap controllers share the same store instances.
 *
 * `isNotAllRated()` had exactly one caller before this
 * (`query.isNotAllRated` in the legacy Query object), now read from the
 * explicit query/document stores.
 */
export default class extends Controller {
  static targets = ["count"]
  static values = {
    queryId: String
  }

  initialize() {
    this.store = getCoreStores().scoring
    this.onStoreChange = () => this.render()
  }

  connect() {
    this.unsubscribeStore = subscribeToStore(this.store, { change: this.onStoreChange })
    this.render()
  }

  disconnect() {
    this.unsubscribeStore?.()
  }

  queryIdValueChanged() {
    this.render()
  }

  render() {
    const queryScore = this.store.queryScore(this.queryIdValue)
    const visible = isNotAllRated(queryScore)

    this.element.classList.toggle("d-none", !visible)
    if (visible) {
      this.countTarget.textContent = queryScore.countMissingRatings
    }
  }
}
