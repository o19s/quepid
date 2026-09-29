/**
 * Compose the live-query callbacks into explicit contracts. Callers do not
 * need to know how the service graph is grouped internally.
 */
export function createLiveQueryAdapters({
  runtime = {},
  scoring = {},
  book = {},
  search = {},
  ratings = {},
  framework = {},
  domain = {}
}) {
  const factoryOptions = runtime.factoryOptions || {}
  const executionOptions = runtime.executionOptions || {}

  return {
    runtime: {
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
