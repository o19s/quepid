// Plain ES module — extracts scoring display logic from Angular ScorerFactory.
// No Angular dependency. Used by Stimulus controllers for rating colors and score badges.

/**
 * Build a color map from a scorer scale array.
 * Input:  [0, 1, 2, 3]
 * Output: { 0: "hsl(0, 100%, 50%)", 1: "hsl(40, 100%, 50%)", ... }
 *
 * Matches Angular ScorerFactory.scaleToColors() exactly.
 */
export function scaleToColors(scale) {
  const colorMap = {}

  if (!scale || scale.length === 0) return colorMap

  const nums = scale.map((v) => parseInt(v, 10))
  const min = nums[0]
  const max = nums[nums.length - 1]
  const range = max - min

  for (const num of nums) {
    let hue = ((num - min) * 120) / range
    if (isNaN(hue)) hue = 0
    colorMap[num] = `hsl(${hue}, 100%, 50%)`
  }

  return colorMap
}

/**
 * Return the background color for a given rating value and color map.
 * Falls back to gray (#777) for unrated or missing ratings.
 */
export function ratingColor(rating, colorMap) {
  if (rating === null || rating === undefined || !Object.hasOwn(colorMap, rating)) {
    return "#777"
  }
  return colorMap[rating]
}

/**
 * Discrete score badge colors (case + query headers).
 * Must stay aligned with Angular `app/assets/javascripts/services/qscore_service.js`
 * `qscoreSvc.scoreToColor()` — not a smooth HSL gradient.
 */
const SCORE_TO_COLOR_BUCKETS = {
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
  10: "hsl(100, 90%, 35%)",
}

/**
 * Maps a numeric score to a badge background color using decile buckets 0–10 (and -1).
 * Same formula as Angular: scale to 0–100, `parseInt` then `Math.round(/10)`.
 */
export function scoreToColor(score, maxScore) {
  if (score === null || score === undefined || maxScore === null || maxScore === undefined) {
    return "#999"
  }
  const max = Number(maxScore)
  if (!max || Number.isNaN(max)) {
    return "#999"
  }
  let s = Number(score)
  if (Number.isNaN(s)) {
    return "#999"
  }
  s = Math.min(s, max)
  s = (s * 100) / max
  const bucket = Math.round(parseInt(String(s), 10) / 10)
  const key = String(bucket)
  return SCORE_TO_COLOR_BUCKETS[key] ?? "#999"
}
