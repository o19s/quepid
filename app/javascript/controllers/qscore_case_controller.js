import { Controller } from "@hotwired/stimulus"
import { formatScore, scoreToColor } from "utils/scoring"

/**
 * Store-driven replacement for the Angular `<qscore-case>` component's primary
 * "current case score" usage in `core/index.html.erb` (`scorable="queries.avgQuery"`)
 * — same pattern as `qscore_query_controller.js`, per
 * docs/todo/angularjs_removal_inventory.md § Re-render mechanism, step 4.
 *
 * Snapshot/diff case scores are rendered separately by the Stimulus
 * `diff-case-scores` controller. The score-history graph is now the Stimulus
 * `qgraph` controller, as a sibling that reads the case scores and annotations
 * APIs directly.
 *
 * Reads `window.quepidStore.scoring` (the bridged `CaseScoreStore` singleton
 * `queriesSvc.scoreAll()` writes into), not a fresh `import` of
 * `stores/case_score_store` — see qscore_query_controller.js's note on why.
 *
 * Colors relative to `caseScore.maxScore`, the average of each live query's own
 * maxScore (`CaseScoreStore` derives it via `averageMaxScore()`), mirroring
 * `queriesCtrl.js`'s `runScore()` computing `$scope.maxScore` the same way for the
 * old `max-score="maxScore || 1"` binding.
 *
 * The score label (the scorer's name) isn't part of the score store — it comes from
 * the case's scorer setting, which `pick-scorer-core` can change mid-session. It
 * starts from the server-rendered value and updates on `pick-scorer:selected`
 * (dispatched by `pick_scorer_core_controller.js` after saving), the same event
 * `queriesSvc` listens for to rescore with the new scorer.
 */
export default class extends Controller {
  static targets = ["value", "label"]
  static values = {
    caseId: Number,
    scoreLabel: String
  }

  initialize() {
    this.store = window.quepidStore.scoring
    this.diffRefreshGeneration = 0
    this.onStoreChange = () => this.renderScore()
    this.onScoringComplete = event => {
      this.persistScore(event.detail)
      this.refreshCaseDiffScores()
    }
    this.onRatingChanged = () => this.refreshCaseDiffScores({ refreshQueries: true })
    this.onDiffsRefreshed = event => this.refreshCaseDiffScores({
      refreshQueries: false,
      failed: event.detail?.success === false
    })
    this.onScorerSelected = (event) => this.handleScorerSelected(event)
  }

  connect() {
    this.store.addEventListener("change", this.onStoreChange)
    this.store.addEventListener("scoring-complete", this.onScoringComplete)
    this.store.addEventListener("rating-changed", this.onRatingChanged)
    document.addEventListener("query-diffs:refreshed", this.onDiffsRefreshed)
    document.addEventListener("pick-scorer:selected", this.onScorerSelected)
    this.renderScore()
    this.renderLabel()
  }

  disconnect() {
    this.store.removeEventListener("change", this.onStoreChange)
    this.store.removeEventListener("scoring-complete", this.onScoringComplete)
    this.store.removeEventListener("rating-changed", this.onRatingChanged)
    document.removeEventListener("query-diffs:refreshed", this.onDiffsRefreshed)
    document.removeEventListener("pick-scorer:selected", this.onScorerSelected)
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

    const injector = window.angular?.element(document.body).injector?.()
    const caseSvc = injector?.get?.("caseSvc")
    const configurationSvc = injector?.get?.("configurationSvc")
    if (!caseSvc || !configurationSvc) return

    const caseId = this.caseIdValue
    const tryNumber = configurationSvc.getTryNo()
    const scoreData = {
      score: scoreInfo.score,
      all_rated: scoreInfo.allRated,
      try_number: tryNumber,
      queries
    }

    const persist = resolvedTryNumber => {
      scoreData.try_number = resolvedTryNumber
      return caseSvc.trackLastScore(caseId, scoreData)
    }

    if (Number.isNaN(tryNumber)) {
      caseSvc.get(caseId).then(aCase => persist(aCase.lastTry))
    } else {
      persist(tryNumber)
    }
  }

  async refreshCaseDiffScores({ refreshQueries = false, failed = false } = {}) {
    this.diffRefreshGeneration ??= 0
    const refreshGeneration = ++this.diffRefreshGeneration
    const injector = window.angular?.element(document.body).injector?.()
    const queryViewSvc = injector?.get?.("queryViewSvc")
    const queriesSvc = injector?.get?.("queriesSvc")
    const documentsStore = window.quepidStore?.documents
    const buildCaseDiffScores = window.quepidSearch?.diffScores?.buildCaseDiffScores

    if (!queryViewSvc || !queriesSvc || !documentsStore || !buildCaseDiffScores) return

    if (failed) {
      documentsStore.clearCaseDiffs()
      return
    }

    if (!queryViewSvc.isAnyDiffEnabled()) {
      documentsStore.clearCaseDiffs()
      return
    }

    const queries = Object.values(queriesSvc.queries || {})
    try {
      if (refreshQueries) {
        await Promise.all(
          queries
            .filter(query => query?.diffs?.fetch)
            .map(query => query.diffs.fetch())
        )
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
