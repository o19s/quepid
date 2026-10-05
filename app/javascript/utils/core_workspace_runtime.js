import { createScorerCatalog } from "utils/scorer_catalog"
import { createMapperSearchRuntime } from "utils/mapper_search_runtime"
import { createSearchEndpointRuntime } from "utils/search_endpoint_runtime"
import { createSettingsCatalog } from "utils/settings_catalog_runtime"
import { createSettingsRuntime } from "utils/settings_runtime"
import { createUserRuntime } from "utils/user_runtime"
import { createConfigurationRuntime } from "utils/configuration_runtime"
import { createNavigationRuntime } from "utils/navigation_runtime"
import { caseRuntime } from "utils/case_runtime"
import { createLiveQueryRuntimeOwner } from "utils/live_query_runtime_owner"
import { createDocCache } from "utils/doc_cache"

/** Construct the case workspace in dependency order before any controller connects.
 * Query state belongs to the live-query owner; controllers receive complete
 * capability groups rather than filling a shared registry during bootstrap.
 */
export function createCoreWorkspaceRuntime({
  splainerSearch,
  store,
  eventTarget = document,
  framework = createNativeFramework()
}) {
  const mapperSearchRuntime = createMapperSearchRuntime()
  const searchEndpointRuntime = createSearchEndpointRuntime()
  const settingsCatalog = createSettingsCatalog()
  const configurationRuntime = createConfigurationRuntime()
  const navigationRuntime = createNavigationRuntime()
  const settingsRuntime = createSettingsRuntime({
    caseNo: () => navigationRuntime.getCaseNo(),
    tryNo: () => navigationRuntime.getTryNo(),
    navigate: (values) => navigationRuntime.navigateTo(values),
    createFieldSpec: (value) => splainerSearch.fieldSpecSvc.createFieldSpec(value)
  })
  const userRuntime = createUserRuntime()
  const docCache = createDocCache({
    resolver: (...args) => splainerSearch.docResolverSvc.createResolver(...args),
    proxyUrlFor: (id) => navigationRuntime.getQuepidProxyUrl(id)
  })
  const snapshotRegistry = {}
  // Scorer callbacks run after construction; the query owner depends on the
  // catalog and the catalog's rated-document callback calls back into that owner.
  const scorerCatalog = createScorerCatalog({
    scorerOptions: {
      schedule: framework.schedule,
      refreshRatedDocs: (queryId, count) =>
        liveQuery.queryCapabilities.refreshRatedDocs(queryId, count)
    }
  })
  const liveQuery = createLiveQueryRuntimeOwner({
    framework,
    domain: {
      settings: {
        editable: () => settingsRuntime.editable(),
        applicable: () => settingsRuntime.applicable(),
        isTrySelected: () => settingsRuntime.isTrySelected(),
        previewArgs: (tryNo, queryParams) => settingsRuntime.previewArgs(tryNo, queryParams)
      },
      scorer: scorerCatalog,
      navigation: { proxyUrlFor: (id) => navigationRuntime.getQuepidProxyUrl(id) }
    },
    splainerSearch,
    snapshotRegistry,
    store,
    eventTarget
  })
  const caseCapabilities = {
    bootstrap: {
      core: createCoreCapabilities(
        configurationRuntime,
        userRuntime,
        settingsRuntime,
        navigationRuntime
      ),
      docCache
    },
    snapshots: {
      capability: createSnapshotCapabilities(
        settingsRuntime,
        settingsCatalog,
        navigationRuntime,
        splainerSearch
      ),
      docCache
    },
    wizard: {
      capability: createWizardCapabilities(
        settingsRuntime,
        settingsCatalog,
        navigationRuntime,
        userRuntime,
        searchEndpointRuntime,
        mapperSearchRuntime,
        splainerSearch,
        docCache
      ),
      docCache
    },
    tuneRelevance: {
      capability: createTuneRelevanceCapabilities(
        settingsRuntime,
        settingsCatalog,
        navigationRuntime,
        searchEndpointRuntime,
        splainerSearch
      ),
      docCache
    }
  }
  return {
    ...liveQuery,
    splainerSearch,
    docCache,
    snapshotRegistry,
    caseRuntime: caseCapabilities,
    get caseState() {
      return caseRuntime.selected() || { caseNo: null, caseName: "", bookId: null, bookName: null }
    }
  }
}

export function createNativeFramework({ schedule } = {}) {
  return {
    schedule: schedule || ((callback) => Promise.resolve().then(callback)),
    logger: console
  }
}

function createSnapshotCapabilities(
  settingsRuntime,
  settingsCatalog,
  navigationRuntime,
  splainerSearch
) {
  return {
    settings: {
      editable: () => settingsRuntime.editable(),
      supportsLookupById: (searchEngine) => settingsCatalog.supportsLookupById(searchEngine)
    },
    navigation: {
      rootUrl: () => navigationRuntime.getQuepidRootUrl(),
      caseNo: () => navigationRuntime.getCaseNo()
    },
    fieldSpec: {
      create: (...args) => splainerSearch.fieldSpecSvc.createFieldSpec(...args)
    },
    documents: {
      explain: (...args) => splainerSearch.normalDocsSvc.explainDoc(...args)
    }
  }
}

function createWizardCapabilities(
  settingsRuntime,
  settingsCatalog,
  navigationRuntime,
  userRuntime,
  searchEndpointRuntime,
  mapperSearchRuntime,
  splainerSearch,
  docCache
) {
  return {
    settings: {
      editable: () => settingsRuntime.editable(),
      registerMapper: (engine) => settingsCatalog.registerMapper(engine),
      pick: (preset, url) => settingsCatalog.pickSettingsToUse(preset, url),
      proxyUrlFor: (searchEndpointId) => navigationRuntime.getQuepidProxyUrl(searchEndpointId),
      demoChosen: (engine, url) => settingsCatalog.demoSettingsChosen(engine, url),
      defaultSolrQueryParams: () => settingsCatalog.defaultSolrQueryParams(),
      applicable: () => settingsRuntime.applicable(),
      update: (value) => settingsRuntime.update(value)
    },
    case: {
      selected: () => caseRuntime.selected(),
      delete: (value) => caseRuntime.delete(value),
      rename: (value, name) => caseRuntime.rename(value, name)
    },
    endpoints: {
      list: () => searchEndpointRuntime.list(),
      all: () => searchEndpointRuntime.all(),
      isEsOrOs: (engine) => searchEndpointRuntime.isEsOrOsEngine(engine)
    },
    mapper: {
      list: () => mapperSearchRuntime.list(),
      all: () => mapperSearchRuntime.all()
    },
    search: {
      createValidator: (value) => splainerSearch.searchSvc.createValidator(value)
    },
    user: {
      current: () => userRuntime.current(),
      shownIntroWizard: () => userRuntime.shownIntroWizard()
    },
    navigation: {
      rootUrl: () => navigationRuntime.getQuepidRootUrl(),
      caseNo: () => navigationRuntime.getCaseNo(),
      needToRedirectProtocol: (url) => navigationRuntime.needToRedirectQuepidProtocol(url),
      swapUrlTls: () => navigationRuntime.swapQuepidUrlTLS(),
      appendQueryParams: (...args) => navigationRuntime.appendQueryParams(...args)
    },
    documents: {
      cache: docCache
    }
  }
}

function createTuneRelevanceCapabilities(
  settingsRuntime,
  settingsCatalog,
  navigationRuntime,
  searchEndpointRuntime,
  splainerSearch
) {
  const esUrlSvc = splainerSearch.esUrlSvc

  return {
    settings: {
      editable: () => settingsRuntime.editable(),
      supportsEscapeQuery: (engine) => settingsCatalog.supportsEscapeQuery(engine),
      troubleshootingWikiUrl: (...args) => settingsCatalog.troubleshootingWikiUrl(...args),
      save: (value) => settingsRuntime.save(value),
      duplicateTry: (tryNo) => settingsRuntime.duplicateTry(tryNo),
      renameTry: (tryNo, name) => settingsRuntime.renameTry(tryNo, name),
      deleteTry: (tryNo) => settingsRuntime.deleteTry(tryNo),
      reload: () => settingsRuntime.editable()
    },
    endpoints: {
      fetchForCase: (caseNo) => searchEndpointRuntime.fetchForCase(caseNo),
      all: () => searchEndpointRuntime.all(),
      isEsOrOs: (engine) => searchEndpointRuntime.isEsOrOsEngine(engine),
      usesJsonQueryParams: (engine) => searchEndpointRuntime.usesJsonQueryParams(engine)
    },
    search: {
      isTemplateCall: (value) => esUrlSvc?.isTemplateCall(value)
    },
    case: {
      selected: () => caseRuntime.selected(),
      updateNightly: (value) => caseRuntime.updateNightly(value),
      runEvaluation: (caseNo, tryNo) => caseRuntime.runEvaluation(caseNo, tryNo)
    },
    navigation: {
      currentCaseNo: () => navigationRuntime.getCaseNo(),
      rootUrl: () => navigationRuntime.getQuepidRootUrl(),
      needToRedirectProtocol: (url) => navigationRuntime.needToRedirectQuepidProtocol(url),
      swapUrlTls: () => navigationRuntime.swapQuepidUrlTLS(),
      appendQueryParams: (...args) => navigationRuntime.appendQueryParams(...args),
      goToTry: (tryNo) => navigationRuntime.navigateTo({ tryNo })
    }
  }
}

function createCoreCapabilities(
  configurationRuntime,
  userRuntime,
  settingsRuntime,
  navigationRuntime
) {
  return {
    configuration: {
      setCommunalScorersOnly: (value) => configurationRuntime.setCommunalScorersOnly(value),
      setQueryListSortable: (value) => configurationRuntime.setQueryListSortable(value),
      setCaseNo: (value) => configurationRuntime.setCaseNo(value),
      setTryNo: (value) => configurationRuntime.setTryNo(value)
    },
    user: {
      initialize: (data) => userRuntime.initialize(data)
    },
    case: {
      selected: () => caseRuntime.selected(),
      initialize: (data) => caseRuntime.initialize(data),
      trackLastViewedAt: (caseNo) => caseRuntime.trackLastViewedAt(caseNo)
    },
    settings: {
      editable: () => settingsRuntime.editable(),
      setCaseTries: (tries) => settingsRuntime.setCaseTries(tries),
      setCurrentTry: (tryNo) => settingsRuntime.setCurrentTry(tryNo),
      isTrySelected: () => settingsRuntime.isTrySelected()
    },
    navigation: {
      currentCaseNo: () => navigationRuntime.getCaseNo(),
      currentTryNo: () => navigationRuntime.getTryNo(),
      complete: (values) => navigationRuntime.navigationCompleted(values),
      needToRedirectQuepidProtocol: (url) => navigationRuntime.needToRedirectQuepidProtocol(url),
      getQuepidProtocol: () => navigationRuntime.getQuepidProtocol(),
      createSearchEndpointLink: (searchEndpointId) =>
        navigationRuntime.createSearchEndpointLink(searchEndpointId),
      proxyUrlFor: (searchEndpointId) => navigationRuntime.getQuepidProxyUrl(searchEndpointId)
    }
  }
}
