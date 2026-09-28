/**
 * Compose the remaining Angular-backed live-query callbacks into explicit
 * contracts. The callbacks still point at Angular services during migration,
 * but callers no longer need to know how those services are grouped.
 */
export function createLiveQueryAdapters({ compatibility = {}, scoring = {}, book = {} }) {
  const factoryOptions = compatibility.factoryOptions || {}
  const executionOptions = compatibility.executionOptions || {}

  return {
    compatibility: {
      factoryOptions: {
        model: {},
        documents: {},
        factory: {},
        ...factoryOptions
      },
      executionOptions: {
        settings: {},
        searchers: {},
        documents: {},
        errors: {},
        ...executionOptions
      }
    },
    scoring: {
      getDefault: scoring.getDefault,
      select: scoring.select,
      bootstrap: scoring.bootstrap
    },
    book: {
      configure: book.configure,
      reset: book.reset,
      sync: book.sync
    }
  }
}
