import { Controller } from "@hotwired/stimulus"
import { isNotAllRated } from "utils/scoring"

/**
 * Store-driven replacement for `searchResults.html`'s per-query "unrated
 * results" frog badge — the first `searchResults`/`queriesCtrl` slice, per
 * docs/todo/angularjs_removal_inventory.md § Re-render mechanism, step 5.
 *
 * Reads `window.quepidStore.scoring` (the bridged `CaseScoreStore` singleton
 * `queriesSvc.scoreAll()` writes into) rather than importing
 * `stores/case_score_store` directly — that module is also esbuild-bundled
 * into `angular_app.js` (`build:angular-vendor`), and a second, separately
 * imported copy here (this controller loads via importmap, unbundled) would
 * be a distinct singleton that never sees Angular's writes. Same pattern as
 * `qscore_query_controller.js`.
 *
 * `isNotAllRated()` had exactly one caller before this
 * (`SearchResultsCtrl.query.isNotAllRated` in
 * `app/assets/javascripts/controllers/searchResults.js`), now deleted there.
 */
export default class extends Controller {
  static targets = ["count"]
  static values = {
    queryId: String
  }

  initialize() {
    this.store = window.quepidStore.scoring
    this.onStoreChange = () => this.render()
  }

  connect() {
    this.store.addEventListener("change", this.onStoreChange)
    this.render()
  }

  disconnect() {
    this.store.removeEventListener("change", this.onStoreChange)
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
