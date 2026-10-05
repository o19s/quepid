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
import { getCoreCapabilities } from "utils/core_capability_access"

const mapperSearchRuntime = createMapperSearchRuntime()
const searchEndpointRuntime = createSearchEndpointRuntime()
const settingsCatalog = createSettingsCatalog()
const configurationRuntime = createConfigurationRuntime()
const navigationRuntime = createNavigationRuntime()
const settingsRuntime = createSettingsRuntime({
  caseNo: () => navigationRuntime.getCaseNo(),
  tryNo: () => navigationRuntime.getTryNo(),
  navigate: (values) => navigationRuntime.navigateTo(values),
  createFieldSpec: (value) =>
    getCoreCapabilities().splainerSearch?.fieldSpecSvc?.createFieldSpec(value) || {}
})
const userRuntime = createUserRuntime()

export function createNativeFramework({ schedule } = {}) {
  const nativeSchedule = schedule || ((callback) => Promise.resolve().then(callback))

  return {
    schedule: nativeSchedule,
    logger: console
  }
}

export function resetCoreServiceCache() {
  mapperSearchRuntime.reset()
  searchEndpointRuntime.reset()
  settingsCatalog.reset()
  configurationRuntime.reset()
  navigationRuntime.reset()
  caseRuntime.reset()
  settingsRuntime.reset()
  userRuntime.reset()
}

const capabilityDefinitions = {
  bootstrap: {
    controller: "core_bootstrap_controller",
    services: []
  },
  snapshots: {
    controller: "snapshot_bridge_controller",
    services: []
  },
  wizard: {
    controller: "wizard_controller",
    services: []
  },
  tuneRelevance: {
    controller: "tune_relevance_controller",
    services: []
  }
}

async function loadCapability(name) {
  const definition = capabilityDefinitions[name]
  if (!definition) throw new Error(`Unknown case runtime capability: ${name}`)

  const runtimeOwner = getCoreCapabilities()
  const runtime = runtimeOwner.caseRuntime
  if (runtime?.[name]) return runtime[name]

  const services = {}

  runtimeOwner.caseRuntime ||= {}
  const nativeFramework = name === "bootstrap" ? createNativeFramework() : null
  const scorerCatalog =
    name === "bootstrap"
      ? createScorerCatalog({
          scorerOptions: {
            schedule: (callback) => nativeFramework.schedule(callback),
            refreshRatedDocs: (queryId, count) =>
              runtimeOwner.queryCapabilities?.refreshRatedDocs(queryId, count)
          }
        })
      : null
  runtimeOwner.caseRuntime[name] =
    name === "bootstrap"
      ? {
          core: createCoreCapabilities(services, userRuntime),
          docCache: runtimeOwner.docCache,
          liveQuery: createLiveQueryCapabilities(services, scorerCatalog)
        }
      : {
          ...services,
          capability: createNamedCapability(
            name,
            services,
            userRuntime,
            searchEndpointRuntime,
            mapperSearchRuntime,
            runtimeOwner
          ),
          docCache: runtimeOwner.docCache
        }
  return runtimeOwner.caseRuntime[name]
}

function createNamedCapability(
  name,
  services,
  userRuntime,
  searchEndpointRuntime,
  mapperSearchRuntime,
  runtimeOwner
) {
  if (name === "snapshots") return createSnapshotCapabilities(services, runtimeOwner)
  if (name === "wizard") {
    return createWizardCapabilities(
      services,
      userRuntime,
      searchEndpointRuntime,
      mapperSearchRuntime,
      runtimeOwner
    )
  }
  if (name === "tuneRelevance")
    return createTuneRelevanceCapabilities(services, searchEndpointRuntime, runtimeOwner)
  return {}
}

function createSnapshotCapabilities(services, runtimeOwner) {
  const splainerSearch = runtimeOwner.splainerSearch || {}

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
  services,
  userRuntime,
  searchEndpointRuntime,
  mapperSearchRuntime,
  runtimeOwner
) {
  const splainerSearch = runtimeOwner.splainerSearch || {}

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
      cache: runtimeOwner.docCache
    }
  }
}

function createTuneRelevanceCapabilities(services, searchEndpointRuntime, runtimeOwner) {
  const esUrlSvc = runtimeOwner.splainerSearch?.esUrlSvc

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

function createCoreCapabilities(services, userRuntime) {
  return {
    configuration: {
      setCommunalScorersOnly: (value) => configurationRuntime.setCommunalScorersOnly(value),
      setQueryListSortable: (value) => configurationRuntime.setQueryListSortable(value),
      setCaseNo: (value) => configurationRuntime.setCaseNo(value),
      setTryNo: (value) => configurationRuntime.setTryNo(value)
    },
    user: {
      loadCurrent: () => userRuntime.loadCurrent()
    },
    case: {
      selected: () => caseRuntime.selected(),
      load: (caseNo) => caseRuntime.load(caseNo),
      select: (value) => caseRuntime.select(value),
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

function createLiveQueryCapabilities(services, scorerCatalog) {
  const framework = createNativeFramework()
  const domain = {
    settings: {
      editable: () => settingsRuntime.editable(),
      applicable: () => settingsRuntime.applicable(),
      isTrySelected: () => settingsRuntime.isTrySelected(),
      previewArgs: (tryNo, queryParams) => settingsRuntime.previewArgs(tryNo, queryParams)
    },
    scorer: scorerCatalog,
    navigation: {
      proxyUrlFor: (searchEndpointId) => navigationRuntime.getQuepidProxyUrl(searchEndpointId)
    }
  }

  return {
    create: ({ search, store }) =>
      createLiveQueryRuntimeOwner({ framework, domain, search, store }),
    framework,
    domain
  }
}

// Named capability entry points are the public contract. The former service
// names are implementation details, not a service locator for controllers.
export function getBootstrapCapabilities() {
  return loadCapability("bootstrap")
}

export function getSnapshotCapabilities() {
  return loadCapability("snapshots")
}

export function getWizardCapabilities() {
  return loadCapability("wizard")
}

export function getTuneRelevanceCapabilities() {
  return loadCapability("tuneRelevance")
}
