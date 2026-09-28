import { createScorerCatalog } from "utils/scorer_catalog"
import { createMapperSearchRuntime } from "utils/mapper_search_runtime"
import { createSearchEndpointRuntime } from "utils/search_endpoint_runtime"
import { createSettingsCatalog } from "utils/settings_catalog_runtime"
import { createSettingsRuntime } from "utils/settings_runtime"
import { createUserRuntime } from "utils/user_runtime"
import { createConfigurationRuntime } from "utils/configuration_runtime"
import { createNavigationRuntime } from "utils/navigation_runtime"
import { createCaseRuntime } from "utils/case_runtime"
import { createScorer } from "utils/scorer_runtime"
import { apiFetch } from "api/fetch"

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
const caseRuntime = createCaseRuntime()
const settingsRuntime = createSettingsRuntime({
  caseNo: () => navigationRuntime.getCaseNo(),
  tryNo: () => navigationRuntime.getTryNo(),
  navigate: (values) => navigationRuntime.navigateTo(values),
  createFieldSpec: (value) =>
    window.quepidSearch?.splainerSearch?.fieldSpecSvc?.createFieldSpec(value) || {}
})
const userRuntime = createUserRuntime()

function createPromiseApi() {
  return {
    resolve: (value) => Promise.resolve(value),
    reject: (value) => Promise.reject(value),
    all: (values) => Promise.all(values),
    defer: () => {
      let resolve
      let reject
      const promise = new Promise((promiseResolve, promiseReject) => {
        resolve = promiseResolve
        reject = promiseReject
      })
      return { promise, resolve, reject }
    }
  }
}

export function createNativeFramework(rootScope) {
  const promiseApi = createPromiseApi()
  const request = async (options = {}) => {
    const method = options.method || "GET"
    const url = new URL(options.url, document.baseURI || window.location.href)
    Object.entries(options.params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) url.searchParams.set(key, value)
    })

    const headers = { ...(options.headers || {}) }
    const init = { method, headers }
    if (options.data !== undefined) {
      headers["Content-Type"] ||= "application/json"
      init.body = typeof options.data === "string" ? options.data : JSON.stringify(options.data)
    }

    const response = await apiFetch(url.toString(), init)
    const data = response.status === 204 ? null : await response.json().catch(() => null)
    const result = {
      data,
      ok: response.ok,
      status: response.status,
      statusText: response.statusText
    }
    if (!response.ok) throw result
    return result
  }

  return {
    request,
    get: (url) => request({ method: "GET", url }),
    promiseApi,
    schedule: (callback) => rootScope.$evalAsync(callback),
    applyAsync: (callback) => rootScope.$applyAsync(callback),
    logger: console,
    reject: promiseApi.reject,
    resolve: promiseApi.resolve
  }
}

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

export function resetCoreServiceCache() {
  servicePromises.clear()
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
    services: ["$rootScope"]
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

  const runtime = window.quepidSearch?.caseRuntime
  if (runtime?.[name]) return runtime[name]

  let services = {}
  if (definition.services.length > 0) {
    try {
      services = await waitForAngularServices(definition.services)
    } catch (error) {
      throw new Error(
        `Unable to load case runtime capability "${name}" for ${definition.controller}: ${error.message}`,
        { cause: error }
      )
    }
  }

  window.quepidSearch ||= {}
  window.quepidSearch.caseRuntime ||= {}
  const nativeFramework = name === "bootstrap" ? createNativeFramework(services.$rootScope) : null
  const scorerCatalog =
    name === "bootstrap"
      ? createScorerCatalog({
          request: nativeFramework.request,
          constructFromData: (data) => createScorer(data, {
            promiseApi: nativeFramework.promiseApi,
            schedule: (callback) => nativeFramework.schedule(callback)
          }),
          initialDefault: createScorer({}, {
            promiseApi: nativeFramework.promiseApi,
            schedule: (callback) => nativeFramework.schedule(callback)
          }),
          promiseApi: nativeFramework.promiseApi
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
      caseNo: () => navigationRuntime.getCaseNo()
    },
    documents: {
      cache: window.quepidSearch.docCache
    }
  }
}

function createTuneRelevanceCapabilities(services, searchEndpointRuntime) {
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

function createCoreCapabilities(services, scorerCatalog, userRuntime) {
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
    },
    scoring: {
      bootstrap: (caseNo) => scorerCatalog.bootstrap(caseNo)
    }
  }
}

function createLiveQueryCapabilities(services, scorerCatalog) {
  const framework = createNativeFramework(services.$rootScope)

  return {
    framework,
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
