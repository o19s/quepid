import { createScorerCatalog } from "utils/scorer_catalog"
import { createMapperSearchRuntime } from "utils/mapper_search_runtime"
import { createSearchEndpointRuntime } from "utils/search_endpoint_runtime"
import { createUserRuntime } from "utils/user_runtime"

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
  userRuntime.reset()
}

const capabilityDefinitions = {
  bootstrap: {
    controller: "core_bootstrap_controller",
    services: [
      "$rootScope",
      "$http",
      "$q",
      "$log",
      "configurationSvc",
      "caseSvc",
      "settingsSvc",
      "caseTryNavSvc",
      "ScorerFactory"
    ]
  },
  snapshots: {
    controller: "snapshot_bridge_controller",
    services: ["settingsSvc", "caseTryNavSvc"]
  },
  wizard: {
    controller: "wizard_controller",
    services: ["caseSvc", "caseTryNavSvc", "settingsSvc"]
  },
  tuneRelevance: {
    controller: "tune_relevance_controller",
    services: ["settingsSvc", "caseTryNavSvc", "caseSvc"]
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
  const { settingsSvc, caseTryNavSvc } = services
  const splainerSearch = window.quepidSearch?.splainerSearch || {}

  return {
    settings: {
      editable: () => settingsSvc.editableSettings(),
      supportsLookupById: (searchEngine) => settingsSvc.supportLookupById(searchEngine)
    },
    navigation: {
      rootUrl: () => caseTryNavSvc.getQuepidRootUrl(),
      caseNo: () => caseTryNavSvc.getCaseNo()
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
  const { caseSvc, caseTryNavSvc, settingsSvc } = services
  const splainerSearch = window.quepidSearch?.splainerSearch || {}

  return {
    settings: {
      editable: () => settingsSvc.editableSettings(),
      registerMapper: (engine) => settingsSvc.registerMapperBasedSearchEngine(engine),
      pick: (preset, url) => settingsSvc.pickSettingsToUse(preset, url),
      proxyUrlFor: (searchEndpointId) => caseTryNavSvc.getQuepidProxyUrl(searchEndpointId),
      demoChosen: (engine, url) => settingsSvc.demoSettingsChosen(engine, url),
      defaultSolrQueryParams: () => settingsSvc.defaultSettings.solr.queryParams,
      applicable: () => settingsSvc.applicableSettings(),
      update: (value) => settingsSvc.update(value)
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
      rootUrl: () => caseTryNavSvc.getQuepidRootUrl(),
      caseNo: () => caseTryNavSvc.getCaseNo()
    },
    documents: {
      cache: window.quepidSearch.docCache
    }
  }
}

function createTuneRelevanceCapabilities(services, searchEndpointRuntime) {
  const { settingsSvc, caseTryNavSvc, caseSvc } = services
  const esUrlSvc = window.quepidSearch?.splainerSearch?.esUrlSvc

  return {
    settings: {
      editable: () => settingsSvc.editableSettings(),
      supportsEscapeQuery: (engine) => settingsSvc.supportsEscapeQuery(engine),
      troubleshootingWikiUrl: (...args) => settingsSvc.troubleshootingWikiUrl(...args),
      save: (value) => settingsSvc.save(value),
      duplicateTry: (tryNo) => settingsSvc.duplicateTry(tryNo),
      renameTry: (tryNo, name) => settingsSvc.renameTry(tryNo, name),
      deleteTry: (tryNo) => settingsSvc.deleteTry(tryNo),
      reload: () => settingsSvc.editableSettings()
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
      currentCaseNo: () => caseTryNavSvc.getCaseNo(),
      rootUrl: () => caseTryNavSvc.getQuepidRootUrl(),
      needToRedirectProtocol: (url) => caseTryNavSvc.needToRedirectQuepidProtocol(url),
      swapUrlTls: () => caseTryNavSvc.swapQuepidUrlTLS(),
      appendQueryParams: (...args) => caseTryNavSvc.appendQueryParams(...args),
      goToTry: (tryNo) => caseTryNavSvc.navigateTo({ tryNo })
    }
  }
}

function createCoreCapabilities(services, scorerCatalog, userRuntime) {
  const { configurationSvc, caseSvc, settingsSvc, caseTryNavSvc } = services

  return {
    configuration: {
      setCommunalScorersOnly: (value) => configurationSvc.setCommunalScorersOnly(value),
      setQueryListSortable: (value) => configurationSvc.setQueryListSortable(value),
      setCaseNo: (value) => configurationSvc.setCaseNo(value),
      setTryNo: (value) => configurationSvc.setTryNo(value)
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
      editable: () => settingsSvc.editableSettings(),
      setCaseTries: (tries) => settingsSvc.setCaseTries(tries),
      setCurrentTry: (tryNo) => settingsSvc.setCurrentTry(tryNo),
      isTrySelected: () => settingsSvc.isTrySelected()
    },
    navigation: {
      currentCaseNo: () => caseTryNavSvc.getCaseNo(),
      currentTryNo: () => caseTryNavSvc.getTryNo(),
      complete: (values) => caseTryNavSvc.navigationCompleted(values),
      needToRedirectQuepidProtocol: (url) => caseTryNavSvc.needToRedirectQuepidProtocol(url),
      getQuepidProtocol: () => caseTryNavSvc.getQuepidProtocol(),
      createSearchEndpointLink: (searchEndpointId) =>
        caseTryNavSvc.createSearchEndpointLink(searchEndpointId),
      proxyUrlFor: (searchEndpointId) => caseTryNavSvc.getQuepidProxyUrl(searchEndpointId)
    },
    scoring: {
      bootstrap: (caseNo) => scorerCatalog.bootstrap(caseNo)
    }
  }
}

function createLiveQueryCapabilities(services, scorerCatalog) {
  const { $rootScope, $http, $q, $log, settingsSvc, caseTryNavSvc } = services

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
        editable: () => settingsSvc.editableSettings(),
        applicable: () => settingsSvc.applicableSettings(),
        isTrySelected: () => settingsSvc.isTrySelected(),
        previewArgs: (tryNo, queryParams) => settingsSvc.previewArgs(tryNo, queryParams)
      },
      scorer: {
        getDefault: () => scorerCatalog.getDefault(),
        constructFromData: (scorerData) => scorerCatalog.constructFromData(scorerData),
        setDefault: (scorer) => scorerCatalog.setDefault(scorer),
        bootstrap: (caseNo) => scorerCatalog.bootstrap(caseNo)
      },
      navigation: {
        proxyUrlFor: (searchEndpointId) => caseTryNavSvc.getQuepidProxyUrl(searchEndpointId)
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
