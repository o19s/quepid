/**
 * Build the snapshot comparison objects used by the live Query model.
 *
 * The Query model is still Angular-owned during the incremental case rewrite,
 * but diff construction is framework-free: callers provide the current
 * settings, snapshot-searcher factory, and query-view selection. Keeping this
 * seam here lets Stimulus own the diff read model without making the diff
 * engine depend on an Angular service.
 */
export function createQueryDiff({ query, diffSettings = [], settings, createSearcherFromSnapshot }) {
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
        return Promise.all(diffSearchers.map((searcher) => {
          const docsForScoring = searcher.docs.filter((doc) => doc.ratedOnly === false)
          return Promise.resolve(query.scoreOthers(docsForScoring)).then((score) => {
            searcher.diffScore = score
            return score
          })
        }))
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
    },

    name(searcherIndex) {
      if (searcherIndex !== undefined && diffSearchers[searcherIndex]) {
        return diffSearchers[searcherIndex].name()
      }
      return diffSearchers.map((searcher) => searcher.name()).join(" vs ")
    },

    names() {
      return diffSearchers.map((searcher) => searcher.name())
    },

    version(searcherIndex) {
      if (searcherIndex !== undefined && diffSearchers[searcherIndex]) {
        return diffSearchers[searcherIndex].version()
      }
      return diffSearchers.map((searcher) => searcher.version())
    },

    score(searcherIndex) {
      if (searcherIndex !== undefined && diffSearchers[searcherIndex]) {
        return Promise.resolve(diffSearchers[searcherIndex].diffScore || { score: null, allRated: false })
      }
      return Promise.resolve(diffSearchers.map((searcher) => {
        return searcher.diffScore || { score: null, allRated: false }
      }))
    }
  }

  if (diffSettings.length === 1 && query.diffs) {
    query.diff = {
      fetch: () => query.diffs.fetch(),
      docs: (onlyRated) => query.diffs.docs(0, onlyRated),
      name: () => query.diffs.name(0),
      version: () => query.diffs.version(0),
      score: () => query.diffs.score(0),
      type: () => "snapshot",
      get diffScore() {
        const searchers = query.diffs.getSearchers()
        return searchers[0]?.diffScore || { score: null, allRated: false }
      },
      get currentScore() {
        return this.diffScore
      }
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
