import {
  buildRatedDocsFilter,
  normalizeSearchEngine,
  ratedDocIds,
  supportsRatedDocsLookup,
  supportsSearchApiRatedDocsLookup
} from "./utils/rated_docs"
import { averageScore, formatScore, isUnratedScore, ratingBackgroundColor } from "./utils/scoring"
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

/**
 * Framework-free query/search logic lifted out of the Angular `queriesSvc`, kept
 * separate from `quepid_dom.js` (DOM helpers) because none of it touches the DOM.
 * Exposed on `window.quepidSearch` for the concatenated Angular bundle
 * (`quepid_angular_app.js`); Stimulus controllers import the modules directly.
 */
const quepidSearch = {
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
  }
}

export default quepidSearch
