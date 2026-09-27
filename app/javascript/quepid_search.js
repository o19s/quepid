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
import {
  createSnapshotSearcher,
  createSnapshotSearcherFromRegistry
} from "./utils/snapshot_searcher"
import { createSnapshotModel } from "./utils/snapshot_model"
import {
  buildSnapshotLookupSettings,
  mapFieldSpecToSolrFormat,
  registerAndHydrateSnapshots,
  registerSnapshotModels
} from "./utils/snapshot_hydration"
import { deleteSnapshot, fetchSnapshot } from "./utils/snapshot_api"
import { scoreAllQueries, scoreQuery } from "./utils/query_scoring"
import { createQueryModel } from "./utils/query_model"
import { createQueryRuntime } from "./utils/query_runtime"
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
  ratings: {
    RatingsStore
  },
  queryScoring: {
    scoreAllQueries,
    scoreQuery
  },
  queryModel: {
    create: createQueryModel
  },
  queryRuntime: {
    create: createQueryRuntime
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
    caseId: null,
    prepareQueries: null,
    commitQueries: null,
    refreshQueries: null
  },
  queryService: {
    buildSearchApiRatedDocsQueryParams,
    buildSearcherRequest,
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
    createSnapshotSearcher,
    createSnapshotSearcherFromRegistry,
    createSnapshotModel,
    buildSnapshotLookupSettings,
    mapFieldSpecToSolrFormat,
    registerAndHydrateSnapshots,
    registerSnapshotModels,
    fetchSnapshot,
    deleteSnapshot
  }
}

export default quepidSearch
