import {
  buildRatedDocsFilter,
  normalizeSearchEngine,
  ratedDocIds,
  supportsRatedDocsLookup,
  supportsSearchApiRatedDocsLookup
} from "./utils/rated_docs"
import { averageScore, formatScore, isUnratedScore, ratingBackgroundColor } from "./utils/scoring"
import { buildCaseDiffScores } from "./utils/diff_scores"
import { createQueryDiff } from "./utils/diff_results"
import { RatingsStore } from "./utils/ratings_store"
import { createSnapshotSearcherFromRegistry } from "./utils/snapshot_searcher"
import { createSnapshotModel } from "./utils/snapshot_model"
import { codeToString, formatCode, parseResponseObject } from "./utils/search_error"
import { createCaseScoringRuntime, scoreAllQueries, scoreQuery } from "./utils/query_scoring"
import { createQueryModel } from "./utils/query_model"
import { createDocCache } from "./utils/doc_cache"
import {
  createQueryRuntime,
  createSearchAllRuntime,
  createTargetedSearchAdapter
} from "./utils/query_runtime"
import { extractCuratorVars } from "./utils/curator_vars"
import { buildQueryDocPairsPayload, createBookSyncRuntime, populateBook } from "./utils/book_sync"
import { buildQueryDocumentsState } from "./utils/query_documents"
import { createLiveQuerySearchRuntime } from "./utils/live_query_search"
import { createLiveQueryModelRuntime } from "./utils/live_query_model"
import { createLiveQueryRuntime } from "./utils/live_query_runtime"
import { createLiveQueryLifecycleRuntime } from "./utils/live_query_lifecycle"
import { createLiveQueryDiffRuntime } from "./utils/live_query_diff"
import { createLiveQueryStateRuntime } from "./utils/live_query_state"
import {
  invalidateRatedDocsCache,
  matchesQueryFilter,
  orderedQueries,
  paginate,
  queryDisplayPositions,
  queryLifecycleState,
  queryResultCount,
  queryStateClass,
  querqyRuleTriggered,
  ratingChangedQueryId
} from "./utils/query_state"
import {
  bootstrapRequest,
  bulkCreateRequest,
  createRequest,
  deleteRequest,
  deleteQuery,
  moveRequest,
  moveQuery,
  positionRequest,
  persistQuery,
  persistQueries
} from "./utils/query_lifecycle"
import {
  buildSearcherRequest,
  buildSearchApiRatedDocsQueryParams,
  createSearcherFromSettings,
  evaluateMapperFunctions,
  matchFeaturesExplain,
  normalizeSearchResults,
  paginateQuery,
  pAll,
  runSearchAll,
  searchQuery,
  settingsWithTryOverrides
} from "./utils/query_service"

/**
 * Framework-free query/search logic lifted out of the Angular `queriesSvc`, kept
 * separate from `quepid_dom.js` (DOM helpers) because none of it touches the DOM.
 * Exposed on `window.quepidSearch` for the concatenated Angular bundle
 * (`quepid_angular_app.js`); Stimulus controllers import the modules directly.
 */
const quepidSearch = {
  docResolverSvc: null,
  docCache: createDocCache({
    resolver: (...args) => window.quepidSearch.docResolverSvc.createResolver(...args),
    proxyUrlFor: (searchEndpointId) => window.quepidSearch.caseRuntime?.bootstrap?.caseTryNavSvc?.getQuepidProxyUrl(searchEndpointId)
  }),
  caseState: {
    caseNo: null,
    caseName: "",
    bookId: null,
    bookName: null
  },
  ratedDocs: {
    buildFilter: buildRatedDocsFilter,
    ids: ratedDocIds,
    normalizeSearchEngine,
    supportsLookup: supportsRatedDocsLookup,
    supportsSearchApiLookup: supportsSearchApiRatedDocsLookup
  },
  scoring: {
    average: averageScore,
    formatDisplay: formatScore,
    isUnrated: isUnratedScore,
    ratingBackgroundColor
  },
  searchErrors: {
    codeToString,
    formatCode,
    parseResponseObject
  },
  ratings: {
    RatingsStore
  },
  queryScoring: {
    createCaseScoringRuntime,
    scoreAllQueries,
    scoreQuery
  },
  queryModel: {
    create: createQueryModel
  },
  queryDocuments: {
    buildState: buildQueryDocumentsState
  },
  curatorVars: {
    extract: extractCuratorVars
  },
  bookSync: {
    buildQueryDocPairsPayload,
    createRuntime: createBookSyncRuntime,
    populateBook
  },
  queryRuntime: {
    create: createQueryRuntime,
    createLive: createLiveQueryRuntime,
    createSearchAll: createSearchAllRuntime,
    createTargetedSearch: createTargetedSearchAdapter
  },
  liveQuerySearch: {
    create: createLiveQuerySearchRuntime
  },
  liveQueryModel: {
    create: createLiveQueryModelRuntime
  },
  liveQueryDiff: {
    create: createLiveQueryDiffRuntime
  },
  liveQueryState: {
    create: createLiveQueryStateRuntime
  },
  diffScores: {
    buildCaseDiffScores
  },
  diff: {
    createQueryDiff
  },
  queryState: {
    invalidateRatedDocsCache,
    matchesQueryFilter,
    orderedQueries,
    paginate,
    queryDisplayPositions,
    queryLifecycleState,
    queryResultCount,
    queryStateClass,
    querqyRuleTriggered,
    ratingChangedQueryId
  },
  // Temporary capability boundary for modern case controllers. The
  // implementation remains Angular-owned until live query/search state moves,
  // but modern code must not depend on the legacy queryState namespace.
  queryCapabilities: {
    getListState: null,
    isSortingEnabled: null,
    setDisplayOrder: null,
    getQuery: null,
    getCaseNo: null,
    searchQuery: null,
    refreshRatedDocs: null,
    reconcileQueryRemoval: null,
    getQueries: null,
    refreshAllDiffs: null,
    scoreAll: null,
    updateScores: null
  },
  queryCommands: {
    rateDocument: null,
    rateAll: null,
    toggleQuery: null,
    paginateQuery: null,
    toggleShowOnlyRated: null,
    searchAll: null,
    collapseAll: null
  },
  queryLifecycle: {
    bootstrapRequest,
    bulkCreateRequest,
    createRequest,
    deleteRequest,
    deleteQuery,
    moveRequest,
    moveQuery,
    positionRequest,
    persistQuery,
    persistQueries,
    createRuntime: createLiveQueryLifecycleRuntime,
    caseId: null,
    prepareQueries: null,
    commitQueries: null,
    refreshQueries: null
  },
  queryService: {
    buildSearchApiRatedDocsQueryParams,
    buildSearcherRequest,
    createSearcherFromSettings,
    evaluateMapperFunctions,
    matchFeaturesExplain,
    normalizeSearchResults,
    paginateQuery,
    pAll,
    runSearchAll,
    searchQuery,
    settingsWithTryOverrides
  },
  snapshotSearch: {
    snapshots: {},
    createSnapshotSearcherFromRegistry,
    createSnapshotModel
  }
}

export default quepidSearch
