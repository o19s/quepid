import { caseRuntime } from "utils/case_runtime"
import { createDocCache } from "utils/doc_cache"

/**
 * Mutable state shared across the core case workspace. Pure query/search
 * helpers are imported directly from their `utils/` modules; this object only
 * holds what the runtime owner installs at boot (query capabilities, commands,
 * lifecycle callbacks) and per-case state. The core entry imports it as a
 * module singleton.
 */
const quepidSearch = {
  docResolverSvc: null,
  docCache: createDocCache({
    resolver: (...args) => quepidSearch.docResolverSvc.createResolver(...args),
    proxyUrlFor: (searchEndpointId) => quepidSearch.caseRuntime?.bootstrap?.core?.navigation?.proxyUrlFor(searchEndpointId)
  }),
  get caseState() {
    return caseRuntime.selected() || {
      caseNo: null, caseName: "", bookId: null, bookName: null
    }
  },
  // Capability boundary for modern case controllers. Modern code does not
  // depend on the internal query-state implementation.
  queryCapabilities: {
    getListState: null,
    setDisplayOrder: null,
    getQuery: null,
    getQueries: null,
    getCaseNo: null,
    resetQueryState: null,
    refreshRatedDocs: null,
    reconcileQueryRemoval: null,
    refreshAllDiffs: null,
    changeSettings: null,
    resetSearchPromise: null,
    getQueryArray: null,
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
    prepareQueries: null,
    commitQueries: null,
    commitPersistedQueries: null,
    refreshQueries: null
  },
  snapshotRegistry: {}
}

export default quepidSearch
