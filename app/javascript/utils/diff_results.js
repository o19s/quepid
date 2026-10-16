/**
 * Build the snapshot comparison objects used by the live Query model.
 *
 * The Query model is owned by the live-query runtime,
 * but diff construction is caller-configured: callers provide the current
 * settings, snapshot-searcher factory, and query-view selection. Keeping this
 * seam here lets Stimulus own the diff read model without making the diff
 * engine depend on a framework service.
 */
export function createQueryDiff({
  query,
  diffSettings = [],
  settings,
  createSearcherFromSnapshot
}) {
  if (diffSettings.length === 0) {
    clearDiffs(query)
    return Promise.resolve()
  }

  const diffSearchers = diffSettings
    .map((diffSetting) => createSearcherFromSnapshot(diffSetting, query, settings))
    .filter(Boolean)

  if (diffSearchers.length === 0) {
    clearDiffs(query)
    return Promise.resolve()
  }

  diffSearchers.forEach((searcher) => {
    searcher.diffScore = { score: "?", allRated: false }
    Object.defineProperty(searcher, "currentScore", {
      get() {
        return this.diffScore
      },
      enumerable: true,
      configurable: true
    })
  })

  query.diffSearchers = diffSearchers
  query.diffs = {
    fetch() {
      return Promise.all(diffSearchers.map((searcher) => searcher.search())).then(() => {
        return Promise.all(
          diffSearchers.map((searcher) => {
            const docsForScoring = searcher.docs.filter((doc) => doc.ratedOnly === false)
            return Promise.resolve(query.scoreOthers(docsForScoring)).then((score) => {
              searcher.diffScore = score
              return score
            })
          })
        )
      })
    },

    getSearchers() {
      return diffSearchers
    },

    getSearcher(index) {
      return diffSearchers[index] || null
    },

    docs(searcherIndex, onlyRated = false) {
      const searcher = diffSearchers[searcherIndex]
      if (!searcher) return []
      return searcher.docs.filter((doc) => doc.ratedOnly === onlyRated)
    }
  }

  if (diffSettings.length === 1 && query.diffs) {
    query.diff = {
      fetch: () => query.diffs.fetch()
    }
  } else {
    query.diff = null
  }

  return query.diffs.fetch()
}

function clearDiffs(query) {
  query.diff = null
  query.diffSearcher = null
  query.diffs = null
  query.diffSearchers = []
}
