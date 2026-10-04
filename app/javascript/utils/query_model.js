/**
 * Query-local state transitions and scoring. The live query runtime owns
 * search, rated-document lookup, and API persistence.
 */
export function createQueryModel({
  query,
  ratingsStore,
  getDefaultScorer,
  scoreQuery,
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
        depthOfRating: query.depthOfRating
      })
    },

    score() {
      if (query.lastScoreVersion === this.version()) {
        return Promise.resolve(query.currentScore)
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
