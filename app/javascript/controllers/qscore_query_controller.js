import { Controller } from "@hotwired/stimulus"
import { subscribeToStore } from "utils/store_subscription"
import { formatScore, scoreToColor, renderScoreState } from "utils/scoring"
import { getCoreStores } from "utils/core_store_access"

/**
 * Store-driven implementation for the core query score component's
 * primary "current query score" usage in the expanded-results template
 * (`<qscore-query scorable="query">`) — the first store subscriber, per
 * the frontend cleanup migration notes, § Re-render mechanism, step 4.
 *
 * Reads the core store through the shared store accessors. The bundled case
 * runtime and importmap controllers share the same store instances.
 *
 * Colors relative to *this query's own* maxScore (`queryScore.maxScore`,
 * e.g. 1.0 for AP@10, from the scorer via the query model's `scoreOthers()`
 * in `utils/query_model.js`), not the case-level `caseScore.maxScore` that
 * `qscore_case_controller.js` uses. The case-level value is an average across
 * all of the case's queries, so coloring one query against it would mix in
 * other queries' scales.
 */
export default class extends Controller {
  static targets = ["value"]
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
    const score = queryScore ? queryScore.score : "?"
    const maxScore = queryScore ? queryScore.maxScore : 1

    this.element.style.backgroundColor = scoreToColor(score, maxScore)
    this.valueTarget.textContent = formatScore(score)
    renderScoreState(this.element, score, maxScore)
  }
}
