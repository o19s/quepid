import { averageMaxScore } from "utils/scoring"

/**
 * Case and per-query scores published by the live query runtime.
 * Stimulus subscribers render the score badges and graph from this store.
 * Case maxScore is the average of the per-query maximum scores.
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

  markRatingChanged(queryId) {
    this.dispatchEvent(new CustomEvent("rating-changed", { detail: { queryId } }))
  }

  /**
   * Called by the live-query runtime (`utils/live_query_runtime_owner.js`)
   * after a full `scoreAll()`. This completed scoring projection is used for
   * case persistence and aggregates, independently of in-flight searches.
   * Replaces all query scores atomically and fires one
   * "change" event followed by "scoring-complete".
   */
  setLatestScoreInfo({ allRated, score, queries }) {
    this._caseScore = { score, allRated, maxScore: averageMaxScore(queries ?? {}) }
    this._queryScores = new Map(Object.entries(queries ?? {}))
    this.dispatchEvent(new CustomEvent("change", { detail: this.snapshot() }))
    this.dispatchEvent(new CustomEvent("scoring-complete", { detail: this.snapshot() }))
  }

  snapshot() {
    return {
      caseScore: this._caseScore,
      queryScores: Object.fromEntries(this._queryScores)
    }
  }
}

// One case workspace per page load — a case/try switch is a real navigation
// (navigation uses a full-document location assignment), not an SPA
// route change, so a module-scoped singleton is safe: a fresh page load gets
// a fresh store.
export const caseScoreStore = new CaseScoreStore()
