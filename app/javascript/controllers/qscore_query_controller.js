import { Controller } from "@hotwired/stimulus"
import { formatScore, scoreToColor } from "utils/scoring"

/**
 * Store-driven replacement for the Angular `<qscore-query>` component's
 * primary "current query score" usage in the expanded-results template
 * (`<qscore-query scorable="query">`) — the first store subscriber, per
 * docs/todo/angularjs_removal_inventory.md § Re-render mechanism, step 4.
 *
 * Reads `window.quepidStore.scoring` (the bridged `CaseScoreStore` singleton
 * `queriesSvc.scoreAll()` writes into) rather than importing
 * `stores/case_score_store` directly — that module is also esbuild-bundled
 * into `angular_app.js` (`build:angular-vendor`), and a second, separately
 * imported copy here (this controller loads via importmap, unbundled) would
 * be a distinct singleton that never sees Angular's writes.
 *
 * Colors relative to *this query's own* maxScore (`queryScore.maxScore`,
 * e.g. 1.0 for AP@10, from the scorer via `Query.prototype.scoreOthers`),
 * not the case-level `$scope.maxScore` the old Angular binding used
 * (`max-score="maxScore || 100"`) — that scope value is an average across
 * all of the case's queries and, per query, often isn't what the old
 * `<qscore-query>` badge actually colored against anyway: Angular's own
 * component read `scorable.currentScore.backgroundColor` first (set by
 * `Query.prototype.scoreOthers` using the query's own maxScore) and only
 * fell back to `qscoreSvc.scoreToColor(ctrl.score, ctrl.maxScore)` — the
 * case-level value — when that was missing, which it never was for the
 * live-query usage. The store's per-query `maxScore` is that same
 * query-specific value, so using it here matches what actually rendered,
 * not the unused case-level fallback.
 */
export default class extends Controller {
  static targets = ["value"]
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
    const score = queryScore ? queryScore.score : "?"
    const maxScore = queryScore ? queryScore.maxScore : 1

    this.element.style.backgroundColor = scoreToColor(score, maxScore)
    this.valueTarget.textContent = formatScore(score)
  }
}
