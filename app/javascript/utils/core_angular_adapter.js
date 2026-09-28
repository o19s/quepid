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
}

const capabilityDefinitions = {
  bootstrap: {
    controller: "core_bootstrap_controller",
    // Instantiate the live-query compatibility provider for its window
    // capability side effects, but do not expose the legacy service to the
    // Stimulus bootstrap controller's service bag.
    providers: ["queriesSvc"],
    services: [
      "configurationSvc",
      "userSvc",
      "caseSvc",
      "settingsSvc",
      "caseTryNavSvc",
      "scorerSvc"
    ]
  },
  snapshots: {
    controller: "snapshot_bridge_controller",
    services: ["settingsSvc", "caseTryNavSvc", "fieldSpecSvc", "normalDocsSvc"]
  },
  wizard: {
    controller: "wizard_controller",
    services: [
      "caseSvc",
      "caseTryNavSvc",
      "mapperBasedSearchEngineSvc",
      "searchEndpointSvc",
      "searchSvc",
      "settingsSvc",
      "userSvc"
    ]
  },
  tuneRelevance: {
    controller: "tune_relevance_controller",
    services: ["settingsSvc", "searchEndpointSvc", "esUrlSvc", "caseTryNavSvc", "caseSvc"]
  }
}

async function loadCapability(name) {
  const definition = capabilityDefinitions[name]
  if (!definition) throw new Error(`Unknown case runtime capability: ${name}`)

  const runtime = window.quepidSearch?.caseRuntime
  if (runtime?.[name]) return runtime[name]

  let services
  try {
    if (definition.providers?.length) await waitForAngularServices(definition.providers)
    services = await waitForAngularServices(definition.services)
  } catch (error) {
    throw new Error(
      `Unable to load case runtime capability "${name}" for ${definition.controller}: ${error.message}`,
      { cause: error }
    )
  }

  window.quepidSearch ||= {}
  window.quepidSearch.caseRuntime ||= {}
  window.quepidSearch.caseRuntime[name] = {
    ...services,
    docCache: window.quepidSearch.docCache
  }
  return window.quepidSearch.caseRuntime[name]
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
