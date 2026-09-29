import { createSearcherFromSettings } from "utils/query_service"

/**
 * Runtime boundary for constructing a live query searcher.
 *
 * The case page still injects the searcher factory and endpoint
 * services, but the search request policy now lives behind a small,
 * focused object that can be reused by the modern case workspace.
 */
export function createLiveQuerySearchRuntime({
  proxyUrlFor,
  isEsOrOs,
  evaluateMapper,
  createSearcher
}) {
  return {
    createSearcherFromSettings(settings, query, options = {}) {
      return createSearcherFromSettings({
        settings,
        query,
        options,
        proxyUrl:
          settings?.proxyRequests === true ? proxyUrlFor(settings.searchEndpointId) : undefined,
        isEsOrOs: isEsOrOs(settings?.searchEngine),
        evaluateMapper,
        createSearcher
      })
    }
  }
}
