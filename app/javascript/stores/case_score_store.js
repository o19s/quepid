import { averageMaxScore } from "../utils/scoring"

/**
 * Dual-run shadow store for case/query score state — the first `EventTarget`-based
 * store in the case-workspace re-render plan (see
 * docs/todo/angularjs_removal_inventory.md § Re-render mechanism, step 3).
 *
 * Angular's digest still owns all rendering. `queriesSvc.scoreAll()` writes into
 * this store as a pure side effect (`window.quepidStore.scoring.setLatestScoreInfo`)
 * so the store's output can be compared against what Angular actually paints before
 * any Stimulus controller reads from it, and before `$scope` is touched. Nothing in
 * the DOM is driven by this store yet — dual-run only.
 *
 * Mirrors `queriesSvc.latestScoreInfo`'s exact shape (`{ allRated, score, queries }`)
 * verbatim; see `queriesSvc.scoreAll()`, and `queriesCtrl.js`'s `avgQuery.currentScore`,
 * which is that same object by reference. `caseScore.maxScore` is not part of that
 * shape — it's derived here via `averageMaxScore()` (average of each query's own
 * maxScore, same math as `queriesCtrl.js`'s `runScore()` computing `$scope.maxScore`,
 * but unconditional rather than gated on the case score being a plain number — see
 * `averageMaxScore()`'s own doc comment for why that gap doesn't matter today).
 * Per-query entries (`queryScore(id)`) carry `score`/`maxScore`/`text`/`numFound`
 * plus `allRated`/`countMissingRatings` — the latter two were added to
 * `queriesSvc.scoreAll()`'s `queryScores[id]` alongside this store (they already
 * existed on `scoreInfo`, from `Query.prototype.scoreOthers`, just weren't copied
 * through) so `query_unrated_badge_controller.js` has what it needs (re-render
 * mechanism step 5).
 */
export class CaseScoreStore extends EventTarget {
  constructor() {
    super()
    // `null` means "scoreAll() hasn't resolved yet" (the moment before the
    // first search/score pass completes) — distinct from a resolved '--'
    // ("scored, but nothing is rated").
    this._caseScore = null
    this._queryScores = new Map()
  }

  get caseScore() {
    return this._caseScore
  }

  queryScore(queryId) {
    return this._queryScores.get(String(queryId)) ?? null
  }

  /**
   * Called by `queriesSvc.scoreAll()` with the exact object it assigns to
   * `svc.latestScoreInfo`. Replaces all query scores atomically and fires one
   * "change" event, mirroring `scoreAll()`'s single `$scope.$emit('scoring-complete')`.
   */
  setLatestScoreInfo({ allRated, score, queries }) {
    this._caseScore = { score, allRated, maxScore: averageMaxScore(queries ?? {}) }
    this._queryScores = new Map(Object.entries(queries ?? {}))
    this.dispatchEvent(new CustomEvent("change", { detail: this.snapshot() }))
  }

  snapshot() {
    return {
      caseScore: this._caseScore,
      queryScores: Object.fromEntries(this._queryScores)
    }
  }
}

// One case workspace per page load — a case/try switch is a real navigation
// (`caseTryNavSvc.navigateTo()` is `$window.location.assign`), not an SPA
// route change, so a module-scoped singleton is safe: a fresh page load gets
// a fresh store.
export const caseScoreStore = new CaseScoreStore()
