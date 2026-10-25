import { averageScore, scoreToColor } from "utils/scoring"

const LEGACY_UNSCORED_STYLE = { "background-color": "hsl(0, 0%, 0%, 0.5)" }

/**
 * Scoring operations extracted from the legacy live-query runtime.
 *
 * Promise scheduling is injected so callers can supply their own async runtime.
 */
export function scoreQuery({ query, docs, ratingsStore, scorer, depthOfRating }) {
  const bestDocs = ratingsStore.bestDocs()
  const scorePromise = scorer.score(query, query.numFound, docs, bestDocs, query.options) || 0
  const maxScore = scorer.maxScore() || 1

  return Promise.resolve(scorePromise).then((score) => {
    const docsToCheck = query.docs.slice(0, depthOfRating)
    let allRated = true
    let countMissingRatings = 0

    docsToCheck.forEach((doc) => {
      if (!doc.hasRating()) {
        allRated = false
        countMissingRatings += 1
      }
    })

    return {
      score: score || 0,
      maxScore,
      allRated,
      countMissingRatings,
      // The score display uses a style object for the '?' / null state and a
      // color string for resolved scores. Keep that public shape.
      backgroundColor:
        score === "?" || score === null ? LEGACY_UNSCORED_STYLE : scoreToColor(score, maxScore)
    }
  })
}

/**
 * Score a collection and aggregate the same case-level read model that
 * the live-query runtime's latest score shape currently exposes.
 */
export function scoreAllQueries({ scorableCollection, logger = console }) {
  const scores = []
  let allRated = true
  const queryScores = {}
  const scorables = Array.isArray(scorableCollection)
    ? scorableCollection
    : Object.values(scorableCollection || {})

  const promises = scorables.map((scorable) =>
    Promise.resolve(scorable.score()).then((scoreInfo) => {
      if (!scoreInfo.allRated) allRated = false

      if (scoreInfo.score === null) {
        logger.log("Skipping null score in scoreAll calculation")
        return undefined
      }

      scores.push(scoreInfo.score)
      queryScores[scorable.queryId] = {
        score: scoreInfo.score,
        maxScore: scoreInfo.maxScore,
        text: scorable.queryText,
        numFound: scorable.numFound,
        allRated: scoreInfo.allRated,
        countMissingRatings: scoreInfo.countMissingRatings
      }

      return scoreInfo
    })
  )

  return Promise.all(promises).then(() => ({
    allRated,
    score: averageScore(scores),
    queries: queryScores
  }))
}

/**
 * Own the case-level scoring lifecycle without owning the live query objects.
 *
 * The current case page injects live query objects through `getScorables`,
 * while the orchestration and completion contract remain runtime-owned. The
 * completion callback lets callers publish the result to their own state.
 */
export function createCaseScoringRuntime({
  getScorables,
  logger = console,
  onComplete = () => {}
}) {
  return {
    scoreAll(scorables) {
      const isFullScoreAll = scorables === undefined
      const collection = isFullScoreAll ? getScorables() : scorables

      return scoreAllQueries({
        scorableCollection: collection,
        logger
      }).then((scoreInfo) => {
        onComplete(scoreInfo, { isFullScoreAll })
        return scoreInfo
      })
    }
  }
}
