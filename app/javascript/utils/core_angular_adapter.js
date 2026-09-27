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
