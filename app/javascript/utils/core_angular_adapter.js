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

export function waitForAngularServices(serviceNames, { intervalMs = 50, maxAttempts = 100 } = {}) {
  return new Promise((resolve, reject) => {
    let attempts = 0

    const attempt = () => {
      attempts += 1
      const injector = angularInjector()

      if (injector) {
        try {
          resolve(Object.fromEntries(serviceNames.map((name) => [name, injector.get(name)])))
          return
        } catch (error) {
          if (attempts >= maxAttempts) {
            reject(error)
            return
          }
        }
      } else if (attempts >= maxAttempts) {
        reject(new Error("Unable to load the Angular core services."))
        return
      }

      window.setTimeout(attempt, intervalMs)
    }

    attempt()
  })
}
