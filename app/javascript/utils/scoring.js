/**
 * Score display, color, and aggregation rules for the case page. Kept
 * framework-free so the rules are unit-tested independently of the stores and
 * Stimulus controllers that render them.
 */

// 'zsr' ("zero search results" — no docs came back for the query) and '--' (no
// ratings yet) are sentinel score values, not numbers. Neither counts toward
// an average.
const UNRATED_SENTINELS = new Set(["zsr", "--"])

export function isUnratedScore(score) {
  return UNRATED_SENTINELS.has(score)
}

/**
 * Formats values at fractionSize 2 (en-US grouping +
 * rounding), which is what the `scoreDisplay` filter delegated to via
 * `$filter('number')(score, 2)`. A sentinel or otherwise non-numeric score
 * ('zsr', '--', null, undefined) passes through unchanged. A NaN score
 * (reachable via a buggy custom scorer — see scorer_runtime.js's score(),
 * which treats NaN as a number and returns it uncoerced) renders as an
 * empty string for NaN values.
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

// Hue gradient from red (worst) to green (best), keyed by the 10% step of
// maxScore that scoreToColor() computes.
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

// Color for the "no score yet" ('?'/null) state.
const UNSCORED_COLOR = "hsl(0, 0%, 0%, 0.5)"

// Color for the "scored, nothing rated" sentinels ('--'/'zsr').
const PENDING_RATING_SCORE_COLOR = "hsl(0, 0%, 91%)"

/**
 * Background color for a score badge (case or query score), scaled between
 * red and green relative to `maxScore`. The percentage is truncated, not
 * rounded (`parseInt(percent, 10)`), before dividing by 10; that result is
 * then rounded to pick the step. Always returns a plain color string.
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
 * id, each entry `{ maxScore, ... }` as published by the live-query runtime's
 * `scoreAll()`), floored at 1. Entries with a null/undefined maxScore are
 * excluded; an empty result set returns `NaN`, and callers apply their own
 * `|| 1` fallback.
 *
 * This runs whatever the case-level score is, even a sentinel ('--'/'zsr') or
 * '?'. That is safe for today's only consumer, `scoreToColor()`, which returns
 * early for those scores before it looks at maxScore. A new caller that uses
 * `caseScore.maxScore` directly should handle those scores itself.
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
 * "hop to it" frog badge's visibility rule. No score yet, an explicit `null`
 * score (scoring hasn't resolved), or already fully rated all read as
 * "nothing to flag".
 */
export function isNotAllRated(queryScore) {
  if (!queryScore || queryScore.score === null || queryScore.allRated) {
    return false
  }
  return true
}

/**
 * Average of the numeric scores in `scores`, ignoring sentinels ('zsr', '--')
 * and nulls. Used for the case-level score (`utils/query_scoring.js`): an
 * empty or all-sentinel set averages to '--' (a "nothing rated yet" state)
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

/** Visible text conveying the score state and scale without its background color. */
export function scoreStateText(score, maxScore) {
  if (score === "?" || score == null) return "Not scored"
  if (score === "--") return "Unrated"
  if (score === "zsr") return "No results"
  if (typeof score !== "number" || !Number.isFinite(score)) return "Unavailable"
  return `of ${formatScore(maxScore)}`
}

export function renderScoreState(element, score, maxScore) {
  let state = element.querySelector(".score-state")
  if (!state) {
    state = document.createElement("span")
    state.className = "score-state"
    element.appendChild(state)
  }
  state.textContent = scoreStateText(score, maxScore)
}
