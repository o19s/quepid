/**
 * Compose the remaining Angular-backed live-query callbacks into explicit
 * contracts. The callbacks still point at Angular services during migration,
 * but callers no longer need to know how those services are grouped.
 */
export function createLiveQueryAdapters({
  compatibility = {},
  scoring = {},
  book = {},
  search = {},
  ratings = {},
  framework = {},
  domain = {}
}) {
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
      bootstrap: scoring.bootstrap,
      run: scoring.run
    },
    book: {
      configure: book.configure,
      reset: book.reset,
      sync: book.sync
    },
    search: {
      create: search.create,
      createSnapshot: search.createSnapshot
    },
    ratings: {
      request: ratings.request,
      changed: ratings.changed
    },
    framework: {
      request: framework.request,
      get: framework.get,
      promiseApi: framework.promiseApi,
      schedule: framework.schedule,
      applyAsync: framework.applyAsync,
      logger: framework.logger,
      reject: framework.reject,
      resolve: framework.resolve
    },
    domain: {
      settings: domain.settings || {},
      scorer: domain.scorer || {},
      navigation: domain.navigation || {},
      search: domain.search || {},
      documents: domain.documents || {}
    }
  }
}
