import { averageScore, scoreToColor } from "./scoring"

const LEGACY_UNSCORED_STYLE = { "background-color": "hsl(0, 0%, 0%, 0.5)" }

/**
 * Framework-free scoring operations extracted from queriesSvc.
 *
 * Promise scheduling is injected because the compatibility adapter still uses
 * Angular's $q while the eventual case runtime will use native Promises.
 */
export function scoreQuery({
  query,
  docs,
  ratingsStore,
  scorer,
  promiseApi = Promise,
  depthOfRating
}) {
  const bestDocs = ratingsStore.bestDocs()
  const scorePromise = scorer.score(query, query.numFound, docs, bestDocs, query.options) || 0
  const maxScore = scorer.maxScore() || 1

  return promiseApi.resolve(scorePromise).then((score) => {
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
      // qscoreSvc historically returned a style object only for the '?' /
      // null state and a color string for resolved scores. Keep that shape
      // while the Angular adapter still exposes currentScore to legacy code.
      backgroundColor:
        score === "?" || score === null ? LEGACY_UNSCORED_STYLE : scoreToColor(score, maxScore)
    }
  })
}

/**
 * Score a collection and aggregate the same case-level read model that
 * queriesSvc.latestScoreInfo currently exposes.
 */
export function scoreAllQueries({ scorableCollection, promiseApi = Promise, logger = console }) {
  const scores = []
  let allRated = true
  const queryScores = {}
  const scorables = Array.isArray(scorableCollection)
    ? scorableCollection
    : Object.values(scorableCollection || {})

  const promises = scorables.map((scorable) =>
    promiseApi.resolve(scorable.score()).then((scoreInfo) => {
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

  return promiseApi.all(promises).then(() => ({
    allRated,
    score: averageScore(scores),
    queries: queryScores
  }))
}

/**
 * Own the case-level scoring lifecycle without owning the live query objects.
 *
 * The current case page still injects Angular Query objects through
 * `getScorables`, but the orchestration and completion contract are now
 * framework-free. The callback is intentionally injected so the compatibility
 * adapter can publish to Angular and the shadow score store during dual-run;
 * the future case entry bundle can replace it with a store write directly.
 */
export function createCaseScoringRuntime({
  getScorables,
  promiseApi = Promise,
  logger = console,
  onComplete = () => {}
}) {
  return {
    scoreAll(scorables) {
      const isFullScoreAll = scorables === undefined
      const collection = isFullScoreAll ? getScorables() : scorables

      return scoreAllQueries({
        scorableCollection: collection,
        promiseApi,
        logger
      }).then((scoreInfo) => {
        onComplete(scoreInfo, { isFullScoreAll })
        return scoreInfo
      })
    }
  }
}
