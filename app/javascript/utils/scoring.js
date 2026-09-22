/**
 * Score display and aggregation math extracted from the Angular `scoreDisplay` /
 * `ratingBgStyle` filters and `queriesSvc.scoreAll()`'s averaging step. Framework-
 * free — no behavior change intended. Pulled out ahead of the case-workspace
 * re-render mechanism (a plain-JS store + Stimulus subscribers, see
 * docs/todo/angularjs_removal_inventory.md § Re-render mechanism) so the display
 * rules are pinned down and unit-tested before the rendering code around them moves.
 */

// 'zsr' ("zero search results" — no docs came back for the query) and '--' (no
// ratings yet) are sentinel score values, not numbers. Neither counts toward
// an average.
const UNRATED_SENTINELS = new Set(["zsr", "--"])

export function isUnratedScore(score) {
  return UNRATED_SENTINELS.has(score)
}

/**
 * Mirrors AngularJS's `number` filter at fractionSize 2 (en-US grouping +
 * rounding), which is what the `scoreDisplay` filter delegated to via
 * `$filter('number')(score, 2)`. A sentinel or otherwise non-numeric score
 * ('zsr', '--', null, undefined) passes through unchanged. A NaN score
 * (reachable via a buggy custom scorer — see ScorerFactory.js's score(),
 * which treats NaN as a number and returns it uncoerced) renders as an
 * empty string, matching Angular's own `isNaN(number) return ''` guard in
 * formatNumber() — `Number.prototype.toLocaleString` has no such guard and
 * would otherwise render the literal string "NaN".
 */
export function formatScore(score) {
  if (typeof score !== "number") {
    return score
  }
  if (Number.isNaN(score)) {
    return ""
  }
  return score.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

// Quepid's built-in 1-10 rating scale, keyed by rating value. A case with a
// custom scorer supplies its own scale object in the same shape instead.
const DEFAULT_RATING_SCALE = {
  1: { color: "#c51800" },
  2: { color: "#e61f00" },
  3: { color: "#fe2400" },
  4: { color: "#fe5b00" },
  5: { color: "#ffad00" },
  6: { color: "#ffd600" },
  7: { color: "#bfd200" },
  8: { color: "#00c700" },
  9: { color: "#00af00" },
  10: { color: "#008900" }
}

const UNRATED_BACKGROUND_COLOR = "#777"

/**
 * Background color for a rating badge. `scale` defaults to Quepid's built-in
 * 1-10 scale when not given; an unrated or out-of-scale rating falls back to
 * grey. Mirrors the `ratingBgStyle` filter's `{ rating, scale }` argument
 * shape exactly (including the `scale === undefined` default check, not a
 * falsy check — an explicitly empty scale object is not the same as "no
 * scale given").
 */
export function ratingBackgroundColor({ rating, scale } = {}) {
  const effectiveScale = scale === undefined ? DEFAULT_RATING_SCALE : scale
  const entry = effectiveScale[rating]
  return { "background-color": entry ? entry.color : UNRATED_BACKGROUND_COLOR }
}

// Hue gradient from red (worst) to green (best), keyed by score rounded down
// to the nearest 10% of maxScore. Mirrors `qscoreSvc.scoreToColor`'s lookup
// table exactly (Angular's `qscoreSvc` keeps its own copy for the qscore-case
// component and qscore-query's diff/snapshot-searcher usage, which aren't
// covered by this extraction).
const SCORE_HUE_STEPS = {
  "-1": "hsl(0, 100%, 40%)",
  0: "hsl(5, 95%, 45%)",
  1: "hsl(10, 90%, 50%)",
  2: "hsl(15, 85%, 55%)",
  3: "hsl(20, 80%, 60%)",
  4: "hsl(24, 75%, 65%)",
  5: "hsl(28, 65%, 75%)",
  6: "hsl(60, 55%, 65%)",
  7: "hsl(70, 70%, 50%)",
  8: "hsl(80, 80%, 45%)",
  9: "hsl(90, 85%, 40%)",
  10: "hsl(100, 90%, 35%)"
}

// Matches `qscoreSvc`'s `defaultStyle` background-color for the "no score
// yet" ('?'/null) state.
const UNSCORED_COLOR = "hsl(0, 0%, 0%, 0.5)"

// Matches `qscoreSvc.scoreToColor`'s color for the "scored, nothing rated"
// sentinels ('--'/'zsr').
const PENDING_RATING_SCORE_COLOR = "hsl(0, 0%, 91%)"

/**
 * Background color for a score badge (case or query score), scaled between
 * red and green relative to `maxScore`. Mirrors `qscoreSvc.scoreToColor`'s
 * math exactly, including truncating (not rounding) the percentage before
 * dividing by 10 (`parseInt(percent, 10)`, not `Math.round`).
 *
 * Unlike `qscoreSvc.scoreToColor`, this always returns a plain color string
 * (never a `{'background-color': ...}` object) — the caller wraps it. The
 * Angular version's '?'/null branch returns a style object that its callers
 * (`qscore_case_controller.js` / `qscore_query_controller.js`) then wrap in
 * a second `{'background-color': ...}`, producing a nested style object that
 * `ng-style` silently can't apply. Not reproduced here: it's an invisible
 * pre-existing bug (the "no score yet" badge briefly renders unstyled), not
 * a behavior worth preserving.
 */
export function scoreToColor(score, maxScore) {
  if (score === "?" || score === null) {
    return UNSCORED_COLOR
  }
  if (isUnratedScore(score)) {
    return PENDING_RATING_SCORE_COLOR
  }
  const cappedScore = Math.min(score, maxScore)
  const percent = (cappedScore * 100) / maxScore
  const step = Math.round(parseInt(percent, 10) / 10)
  return SCORE_HUE_STEPS[step]
}

/**
 * Average per-query maxScore across `queryScores` (an object keyed by query
 * id, each entry shaped like `queriesSvc.scoreAll()`'s `queryScores` —
 * `{ maxScore, ... }`), floored at 1. Entries with a null/undefined maxScore
 * are excluded; an empty result set returns `NaN` — callers apply their own
 * `|| 1` fallback, matching the `max-score="maxScore || 1"` binding this
 * replaces.
 *
 * Unlike `queriesCtrl.js`'s `runScore()` (which this otherwise mirrors),
 * this runs unconditionally rather than only when the case-level score is a
 * plain number (`runScore()` guards on `angular.isNumber(lastScore) &&
 * lastScore !== -1` before touching `$scope.maxScore` at all). That guard
 * doesn't need reproducing here: every current caller of `caseScore.maxScore`
 * (`scoreToColor()`) already short-circuits on a sentinel/`'?'`/null score
 * before it would ever consult maxScore, so the two behave identically in
 * practice. A future caller that uses `maxScore` without that same
 * sentinel-first branching would see a real value here where Angular would
 * have left `$scope.maxScore` at its prior (possibly stale/undefined) state
 * — worth re-checking this guard if one shows up.
 */
export function averageMaxScore(queryScores) {
  const maxScores = Object.values(queryScores)
    .map((entry) => entry.maxScore)
    .filter((maxScore) => maxScore !== null && maxScore !== undefined)

  if (maxScores.length === 0) {
    return NaN
  }

  const avg = maxScores.reduce((sum, maxScore) => sum + maxScore, 0) / maxScores.length
  return Math.max(1, avg)
}

/**
 * Whether a query has been scored but still has results left to rate — the
 * "hop to it" frog badge's visibility rule. Mirrors `SearchResultsCtrl`'s
 * `$scope.query.isNotAllRated()` (`app/assets/javascripts/controllers/searchResults.js`)
 * exactly: no score yet, an explicit `null` score (scoring hasn't resolved),
 * or already fully rated all read as "nothing to flag".
 */
export function isNotAllRated(queryScore) {
  if (!queryScore || queryScore.score === null || queryScore.allRated) {
    return false
  }
  return true
}

/**
 * Average of the numeric scores in `scores`, ignoring sentinels ('zsr', '--')
 * and nulls. Mirrors `queriesSvc.scoreAll()`'s aggregation: an empty or
 * all-sentinel set averages to '--' (a case-level "nothing rated yet" state)
 * rather than 0 or NaN.
 */
export function averageScore(scores) {
  // Sentinels are strings, so `typeof score === "number"` alone already
  // excludes them (and excludes null/undefined, which `isUnratedScore`
  // would not). Checking both makes the exclusion rule visibly centralized
  // in `isUnratedScore` rather than two predicates a reader has to trust
  // happen to agree.
  const numericScores = scores.filter(
    (score) => typeof score === "number" && !isUnratedScore(score)
  )
  if (numericScores.length === 0) {
    return "--"
  }
  return numericScores.reduce((sum, score) => sum + score, 0) / numericScores.length
}
