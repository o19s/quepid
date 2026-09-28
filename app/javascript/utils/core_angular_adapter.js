import { createScorerCatalog } from "utils/scorer_catalog"
import { createMapperSearchRuntime } from "utils/mapper_search_runtime"
import { createSearchEndpointRuntime } from "utils/search_endpoint_runtime"
import { createSettingsCatalog } from "utils/settings_catalog_runtime"
import { createSettingsRuntime } from "utils/settings_runtime"
import { createUserRuntime } from "utils/user_runtime"
import { createConfigurationRuntime } from "utils/configuration_runtime"
import { createNavigationRuntime } from "utils/navigation_runtime"

/**
 * Temporary seam for the Angular services that still own live case state.
 *
 * Core Stimulus controllers use this module instead of reaching into the Angular injector
 * themselves. The seam is intentionally small and temporary: it disappears with the live query
 * state migration, while the surrounding page can already be Stimulus-owned.
 */
export function angularInjector() {
  const root = document.querySelector("[ng-app]")
  return window.angular?.element(root)?.injector?.()
}

const servicePromises = new Map()
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
    window.quepidSearch?.splainerSearch?.fieldSpecSvc?.createFieldSpec(value) || {}
})
const userRuntime = createUserRuntime()

export function waitForAngularServices(serviceNames, { intervalMs = 50, maxAttempts = 100 } = {}) {
  return new Promise((resolve, reject) => {
    let attempts = 0

    const cacheKey = serviceNames.slice().sort().join(",")
    const cached = servicePromises.get(cacheKey)
    if (cached) {
      cached.then(resolve, reject)
      return
    }

    const promise = new Promise((resolveServices, rejectServices) => {
      const attempt = () => {
        attempts += 1
        const injector = angularInjector()

        if (injector) {
          try {
            resolveServices(
              Object.fromEntries(serviceNames.map((name) => [name, injector.get(name)]))
            )
            return
          } catch (error) {
            if (attempts >= maxAttempts) {
              rejectServices(error)
              return
            }
          }
        } else if (attempts >= maxAttempts) {
          rejectServices(new Error("Unable to load the Angular core services."))
          return
        }

        window.setTimeout(attempt, intervalMs)
      }

      attempt()
    })

    servicePromises.set(cacheKey, promise)
    promise.then(resolve, (error) => {
      servicePromises.delete(cacheKey)
      reject(error)
    })
  })
}

export async function runInAngular(operation) {
  const { $rootScope: rootScope } = await waitForAngularServices(["$rootScope"])

  return new Promise((resolve, reject) => {
    rootScope.$evalAsync(() => {
      try {
        Promise.resolve(operation()).then(resolve, reject)
      } catch (error) {
        reject(error)
      }
    })
  })
}

export function resetCoreServiceCache() {
  servicePromises.clear()
  mapperSearchRuntime.reset()
  searchEndpointRuntime.reset()
  settingsCatalog.reset()
  configurationRuntime.reset()
  navigationRuntime.reset()
  settingsRuntime.reset()
  userRuntime.reset()
}

const capabilityDefinitions = {
  bootstrap: {
    controller: "core_bootstrap_controller",
    services: ["$rootScope", "$http", "$q", "$log", "caseSvc", "ScorerFactory"]
  },
  snapshots: {
    controller: "snapshot_bridge_controller",
    services: []
  },
  wizard: {
    controller: "wizard_controller",
    services: ["caseSvc"]
  },
  tuneRelevance: {
    controller: "tune_relevance_controller",
    services: ["caseSvc"]
  }
}

async function loadCapability(name) {
  const definition = capabilityDefinitions[name]
  if (!definition) throw new Error(`Unknown case runtime capability: ${name}`)

  const runtime = window.quepidSearch?.caseRuntime
  if (runtime?.[name]) return runtime[name]

  let services
  try {
    services = await waitForAngularServices(definition.services)
  } catch (error) {
    throw new Error(
      `Unable to load case runtime capability "${name}" for ${definition.controller}: ${error.message}`,
      { cause: error }
    )
  }

  window.quepidSearch ||= {}
  window.quepidSearch.caseRuntime ||= {}
  const scorerCatalog =
    name === "bootstrap"
      ? createScorerCatalog({
          request: services.$http,
          constructFromData: (data) => new services.ScorerFactory(data),
          initialDefault: new services.ScorerFactory(),
          promiseApi: services.$q
        })
      : null
  window.quepidSearch.caseRuntime[name] =
    name === "bootstrap"
      ? {
          core: createCoreCapabilities(services, scorerCatalog, userRuntime),
          docCache: window.quepidSearch.docCache,
          liveQuery: createLiveQueryCapabilities(services, scorerCatalog)
        }
      : {
          ...services,
          capability: createNamedCapability(
            name,
            services,
            userRuntime,
            searchEndpointRuntime,
            mapperSearchRuntime
          ),
          docCache: window.quepidSearch.docCache
        }
  return window.quepidSearch.caseRuntime[name]
}

function createNamedCapability(
  name,
  services,
  userRuntime,
  searchEndpointRuntime,
  mapperSearchRuntime
) {
  if (name === "snapshots") return createSnapshotCapabilities(services)
  if (name === "wizard") {
    return createWizardCapabilities(
      services,
      userRuntime,
      searchEndpointRuntime,
      mapperSearchRuntime
    )
  }
  if (name === "tuneRelevance")
    return createTuneRelevanceCapabilities(services, searchEndpointRuntime)
  return {}
}

function createSnapshotCapabilities(services) {
  const splainerSearch = window.quepidSearch?.splainerSearch || {}

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
  mapperSearchRuntime
) {
  const { caseSvc } = services
  const splainerSearch = window.quepidSearch?.splainerSearch || {}

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
      selected: () => caseSvc.getSelectedCase(),
      delete: (value) => caseSvc.deleteCase(value),
      rename: (value, name) => caseSvc.renameCase(value, name)
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
      caseNo: () => navigationRuntime.getCaseNo()
    },
    documents: {
      cache: window.quepidSearch.docCache
    }
  }
}

function createTuneRelevanceCapabilities(services, searchEndpointRuntime) {
  const { caseSvc } = services
  const esUrlSvc = window.quepidSearch?.splainerSearch?.esUrlSvc

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
      selected: () => caseSvc.getSelectedCase(),
      updateNightly: (value) => caseSvc.updateNightly(value),
      runEvaluation: (caseNo, tryNo) => caseSvc.runEvaluation(caseNo, tryNo)
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

function createCoreCapabilities(services, scorerCatalog, userRuntime) {
  const { caseSvc } = services

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
      load: (caseNo) => caseSvc.get(caseNo),
      select: (value) => caseSvc.selectTheCase(value),
      trackLastViewedAt: (caseNo) => caseSvc.trackLastViewedAt(caseNo),
      fetchDropdownCases: () => caseSvc.fetchDropdownCases()
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
    },
    scoring: {
      bootstrap: (caseNo) => scorerCatalog.bootstrap(caseNo)
    }
  }
}

function createLiveQueryCapabilities(services, scorerCatalog) {
  const { $rootScope, $http, $q, $log } = services

  return {
    framework: {
      request: (options) => $http(options),
      get: (url) => $http.get(url),
      promiseApi: $q,
      schedule: (callback) => $rootScope.$evalAsync(callback),
      applyAsync: (callback) => $rootScope.$applyAsync(callback),
      logger: $log,
      reject: (message) => $q.reject(message),
      resolve: (value) => $q.resolve(value)
    },
    domain: {
      settings: {
        editable: () => settingsRuntime.editable(),
        applicable: () => settingsRuntime.applicable(),
        isTrySelected: () => settingsRuntime.isTrySelected(),
        previewArgs: (tryNo, queryParams) => settingsRuntime.previewArgs(tryNo, queryParams)
      },
      scorer: {
        getDefault: () => scorerCatalog.getDefault(),
        constructFromData: (scorerData) => scorerCatalog.constructFromData(scorerData),
        setDefault: (scorer) => scorerCatalog.setDefault(scorer),
        bootstrap: (caseNo) => scorerCatalog.bootstrap(caseNo)
      },
      navigation: {
        proxyUrlFor: (searchEndpointId) => navigationRuntime.getQuepidProxyUrl(searchEndpointId)
      }
    }
  }
}

// Named capability entry points are the public contract. The Angular service names above are
// implementation details of this compatibility adapter, not a service locator for controllers.
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
