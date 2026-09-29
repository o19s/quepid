import { createQueryRuntime } from "utils/query_runtime"

/**
 * Adapter factory for the live Query search lifecycle.
 *
 * The case service supplies legacy searchers, document factories, and
 * publication callbacks. Query runtime construction stays framework-free so
 * the future case workspace can provide the same contract directly.
 */
export function createLiveQueryRuntime({
  createRuntime = createQueryRuntime,
  getSettings,
  copySettings,
  createSearcher,
  createRatedSearcher,
  searchApiRatedDocs,
  supportsSearchApiRatedDocsLookup,
  createSnapshotSearcher,
  normalizeDocuments,
  createDocList,
  createRateableDoc = (_query, doc) => doc,
  matchFeaturesExplain,
  setDocs,
  onError,
  parseError,
  publish,
  promiseApi,
  logger
}) {
  return {
    create(query) {
      return createRuntime({
        query,
        getSettings,
        copySettings,
        createSearcher: (options) => createSearcher(query, options),
        createRatedSearcher: (settings) => createRatedSearcher(settings, query),
        searchApiRatedDocs,
        supportsSearchApiRatedDocsLookup,
        createSnapshotSearcher: (snapshotId) => createSnapshotSearcher(snapshotId, query),
        normalizeDocuments: (searcher, fieldSpec) => normalizeDocuments(query, searcher, fieldSpec),
        createDocList,
        createRateableDoc: (doc) => createRateableDoc(query, doc),
        matchFeaturesExplain,
        setDocs: (docs, numFound) => setDocs(query, docs, numFound),
        onError: (message) => onError(query, message),
        parseError,
        publish,
        promiseApi,
        logger
      })
    }
  }
}
