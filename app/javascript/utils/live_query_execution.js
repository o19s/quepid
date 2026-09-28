import { createLiveQueryRuntime } from "utils/live_query_runtime"

/**
 * Assemble the live-query execution contract from searcher, document, and
 * error adapters. The case page can replace these adapters without changing
 * command orchestration or query-model code.
 */
export function createLiveQueryExecutionRuntime(options) {
  if (!options.settings) return createLiveQueryRuntime(options)

  const {
    createRuntime = createLiveQueryRuntime,
    settings,
    searchers,
    documents,
    errors,
    publish,
    promiseApi,
    logger
  } = options

  return createRuntime({
    getSettings: settings.get,
    copySettings: settings.copy,
    createSearcher: searchers.create,
    createRatedSearcher: searchers.createRated,
    searchApiRatedDocs: searchers.searchApiRatedDocs,
    supportsSearchApiRatedDocsLookup: searchers.supportsRated,
    createSnapshotSearcher: searchers.createSnapshot,
    normalizeDocuments: documents.normalize,
    createDocList: documents.createList,
    createRateableDoc: documents.createRateable,
    matchFeaturesExplain: documents.matchFeaturesExplain,
    setDocs: documents.setDocs,
    onError: errors.onError,
    parseError: errors.parse,
    publish,
    promiseApi,
    logger
  })
}
