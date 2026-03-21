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
  if (rating === null || rating === undefined || !(rating in colorMap)) {
    return "#777"
  }
  return colorMap[rating]
}

/**
 * Compute the score-to-color for the query score badge.
 * Maps a score (0..maxScore) to an HSL hue (0=red, 120=green).
 * Matches Angular qscoreSvc.scoreToColor().
 */
export function scoreToColor(score, maxScore) {
  if (score === null || score === undefined || maxScore === 0) {
    return "#999"
  }
  const ratio = Math.max(0, Math.min(score / maxScore, 1))
  const hue = ratio * 120
  return `hsl(${hue}, 100%, 50%)`
}
