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
  moveRequest,
  positionRequest,
  persistQuery,
  persistQueries
} from "./utils/query_lifecycle"
import {
  evaluateMapperFunctions,
  matchFeaturesExplain,
  pAll,
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
    moveRequest,
    positionRequest,
    persistQuery,
    persistQueries,
    caseId: null,
    prepareQueries: null,
    commitQueries: null,
    refreshQueries: null,
    moveQuery: null
  },
  queryService: {
    evaluateMapperFunctions,
    matchFeaturesExplain,
    pAll,
    settingsWithTryOverrides
  }
}

export default quepidSearch
