/**
 * Framework-free per-query state and scoring contract.
 *
 * The Angular queriesSvc still owns search, rated-document lookup, and API
 * persistence. This module owns query-local state transitions so those
 * operations can move behind the same contract without changing the live
 * case-page behavior in one large cutover.
 */
export function createQueryModel({
  query,
  ratingsStore,
  getDefaultScorer,
  scoreQuery,
  promiseApi,
  getFieldSpec,
  getQueryState,
  buildRatingsFilter,
  ratedDocIds,
  onDirty = () => {},
  publish = () => {}
}) {
  let version = 1

  return {
    setDirty() {
      version += 1
      onDirty()
    },

    touchModifiedAt() {
      query.modifiedAt = new Date().toISOString()
    },

    persisted() {
      return Boolean(query.queryId && query.queryId >= 0)
    },

    effectiveScorer() {
      return query.scorer || getDefaultScorer()
    },

    scoreOthers(otherDocs) {
      return scoreQuery({
        query,
        docs: otherDocs,
        ratingsStore,
        scorer: this.effectiveScorer(),
        promiseApi,
        depthOfRating: query.depthOfRating
      })
    },

    score() {
      if (query.lastScoreVersion === this.version()) {
        const deferred = promiseApi.defer()
        deferred.resolve(query.currentScore)
        return deferred.promise
      }

      return this.scoreOthers(query.docs).then((score) => {
        query.currentScore = score
        query.hasBeenScored = true
        query.lastScore = score.score || 0
        query.allRated = score.allRated
        query.lastScoreVersion = this.version()
        publish(query)
        return score
      })
    },

    fieldSpec() {
      return getFieldSpec()
    },

    maxDocScore() {
      return query.docs.reduce((max, doc) => {
        if (typeof doc.score !== "function") return max
        return Math.max(doc.score(), max)
      }, 0)
    },

    version() {
      return version + ratingsStore.version()
    },

    state() {
      return getQueryState()
    },

    filterToRatings(settings, slice) {
      return buildRatingsFilter({
        searchEngine: settings.searchEngine,
        idField: settings.createFieldSpec().id,
        ratedIds: ratedDocIds(query.ratings, slice, settings.numberOfRows)
      })
    }
  }
}
