import { scoreToColor } from "utils/scoring"

/**
 * Build the plain case-level read model used by the Stimulus diff-score header.
 * Query diff searchers remain owned by the live case engine for now; this
 * helper owns only the framework-free aggregation and display data.
 */
export function buildCaseDiffScores(queries, maxScore = 1) {
  const queryList = Array.isArray(queries) ? queries : Object.values(queries || {})
  const firstQuery = queryList.find(query => query?.diffs?.getSearchers)
  if (!firstQuery) return []

  return firstQuery.diffs.getSearchers().map((templateSearcher, searcherIndex) => {
    let totalScore = 0
    let validScores = 0
    let allRated = true

    queryList.forEach(query => {
      const searcher = query?.diffs?.getSearcher?.(searcherIndex)
      const scoreInfo = searcher?.diffScore
      if (!scoreInfo) return

      if (typeof scoreInfo.score === "number") {
        totalScore += scoreInfo.score
        validScores += 1
      }
      if (!scoreInfo.allRated) allRated = false
    })

    const score = validScores > 0 ? totalScore / validScores : "--"
    const effectiveMaxScore = maxScore || 1

    return {
      name: templateSearcher.name(),
      version: templateSearcher.version(),
      score: {
        score,
        maxScore: effectiveMaxScore,
        allRated,
        backgroundColor: scoreToColor(score, effectiveMaxScore)
      }
    }
  })
}
