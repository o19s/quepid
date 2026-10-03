import { Controller } from "@hotwired/stimulus"
import { postJson } from "api/json"
import { formatScore, scoreToColor } from "utils/scoring"
import { buildCaseDiffScores } from "utils/diff_scores"
import { diffStateStore } from "stores/diff_state_store"
import { getCoreStores } from "utils/core_store_access"
import { getCoreCapabilities } from "utils/core_capability_access"

/**
 * Store-driven implementation for the core case score component's primary
 * "current case score" usage in `core/index.html.erb` (`scorable="queries.avgQuery"`)
 * — same pattern as `qscore_query_controller.js`, per
 * the frontend cleanup migration notes, § Re-render mechanism, step 4.
 *
 * Snapshot/diff case scores are rendered separately by the Stimulus
 * `diff-case-scores` controller. The score-history graph is now the Stimulus
 * `qgraph` controller, as a sibling that reads the case scores and annotations
 * APIs directly.
 *
 * Reads the core stores through the temporary runtime adapter, which
 * preserves the bundled singleton while the runtimes are built separately.
 *
 * Colors relative to `caseScore.maxScore`, the average of each live query's own
 * maxScore (`CaseScoreStore` derives it via `averageMaxScore()`), falling back to 1
 * when no query has a usable maxScore.
 *
 * The score label (the scorer's name) isn't part of the score store — it comes from
 * the case's scorer setting, which `pick-scorer-core` can change mid-session. It
 * starts from the server-rendered value and updates on `pick-scorer:selected`
 * (dispatched by `pick_scorer_core_controller.js` after saving), the same event
 * `utils/live_query_events.js` listens for to rescore with the new scorer.
 */
export default class extends Controller {
  static targets = ["value", "label"]
  static values = {
    caseId: Number,
    scoreLabel: String,
    scoreUrl: String,
    tryNumber: Number
  }

  initialize() {
    this.coreStores = getCoreStores()
    this.store = this.coreStores.scoring
    this.diffRefreshGeneration = 0
    this.onStoreChange = () => this.renderScore()
    this.onScoringComplete = event => {
      this.persistScore(event.detail)
      this.refreshCaseDiffScores()
    }
    this.onRatingChanged = () => this.refreshCaseDiffScores({ refreshQueries: true })

  }

  connect() {
    this.store.addEventListener("change", this.onStoreChange)
    this.store.addEventListener("scoring-complete", this.onScoringComplete)
    this.store.addEventListener("rating-changed", this.onRatingChanged)
    this.renderScore()
    this.renderLabel()
  }

  disconnect() {
    this.store.removeEventListener("change", this.onStoreChange)
    this.store.removeEventListener("scoring-complete", this.onScoringComplete)
    this.store.removeEventListener("rating-changed", this.onRatingChanged)
  }

  handleDiffsRefreshed(event) {
    return this.refreshCaseDiffScores({
      refreshQueries: false,
      failed: event.detail?.success === false
    })
  }

  handleScorerSelected(event) {
    const detail = event.detail || {}
    if (Number(detail.caseId) !== this.caseIdValue || !detail.scorer) return

    this.scoreLabelValue = detail.scorer.name
    this.renderLabel()
  }

  renderLabel() {
    if (this.hasLabelTarget) this.labelTarget.textContent = this.scoreLabelValue
  }

  renderScore() {
    const caseScore = this.store.caseScore
    const score = caseScore ? caseScore.score : "?"
    const maxScore = (caseScore && caseScore.maxScore) || 1

    this.element.style.backgroundColor = scoreToColor(score, maxScore)
    this.valueTarget.textContent = formatScore(score)
  }

  persistScore(snapshot) {
    const scoreInfo = snapshot?.caseScore
    const queries = snapshot?.queryScores
    if (
      !scoreInfo ||
      typeof scoreInfo.score !== "number" ||
      !Number.isFinite(scoreInfo.score) ||
      scoreInfo.score === -1 ||
      !queries ||
      Object.keys(queries).length === 0
    ) return

    if (!this.hasScoreUrlValue || !this.scoreUrlValue) return

    const tryNumber = this.tryNumberValue
    if (!Number.isInteger(tryNumber) || tryNumber <= 0) return

    const scoreData = {
      score: scoreInfo.score,
      all_rated: scoreInfo.allRated,
      try_number: tryNumber,
      queries: Object.fromEntries(
        Object.entries(queries).map(([id, score]) => [
          id,
          score === null || score === undefined || score === "Null" ? "" : score
        ])
      )
    }

    return postJson(this.scoreUrlValue, { case_score: scoreData }, { method: "PUT" }).then(() => {
      document.dispatchEvent(new CustomEvent("case-score:persisted", {
        detail: { caseId: this.caseIdValue }
      }))
    }).catch(error => {
      console.error("qscore-case: score persistence failed", error)
    })
  }

  async refreshCaseDiffScores({ refreshQueries = false, failed = false } = {}) {
    this.diffRefreshGeneration ??= 0
    const refreshGeneration = ++this.diffRefreshGeneration
    const stores = this.coreStores || getCoreStores()
    const documentsStore = stores.documents
    const capabilities = getCoreCapabilities()

    if (!documentsStore) return

    if (failed) {
      documentsStore.clearCaseDiffs()
      return
    }

    const comparisonStore = stores.diff || diffStateStore
    if (comparisonStore.selections().length === 0) {
      documentsStore.clearCaseDiffs()
      return
    }

    const queryCapabilities = capabilities.queryCapabilities
    const queries = Object.values(queryCapabilities?.getQueries?.() || {})
    if (!queryCapabilities?.refreshAllDiffs) return
    try {
      if (refreshQueries) {
        await queryCapabilities.refreshAllDiffs()
      }

      if (refreshGeneration !== this.diffRefreshGeneration) return

      const maxScore = this.store.caseScore?.maxScore || 1
      documentsStore.setCaseDiffs(buildCaseDiffScores(queries, maxScore))
    } catch (error) {
      if (refreshGeneration === this.diffRefreshGeneration) {
        documentsStore.clearCaseDiffs()
      }
    }
  }
}
