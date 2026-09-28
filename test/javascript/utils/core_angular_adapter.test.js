import { afterEach, describe, expect, it, vi } from "vitest"
import {
  getBootstrapCapabilities,
  getSnapshotCapabilities,
  getTuneRelevanceCapabilities,
  getWizardCapabilities,
  resetCoreServiceCache,
  runInAngular,
  waitForAngularServices
} from "utils/core_angular_adapter"

describe("core Angular adapter", () => {
  afterEach(() => {
    delete window.angular
    delete window.quepidSearch
    document.body.innerHTML = ""
    resetCoreServiceCache()
    vi.restoreAllMocks()
  })

  it("resolves the requested services from the core injector", async () => {
    document.body.setAttribute("ng-app", "QuepidApp")
    const services = { settingsSvc: { name: "settings" }, caseSvc: { name: "case" } }
    const injector = { get: vi.fn(name => services[name]) }
    window.angular = { element: vi.fn(() => ({ injector: () => injector })) }

    await expect(waitForAngularServices(["settingsSvc", "caseSvc"])).resolves.toEqual(services)
    expect(injector.get).toHaveBeenCalledWith("settingsSvc")
    expect(injector.get).toHaveBeenCalledWith("caseSvc")
  })

  it("rejects when Angular never becomes available", async () => {
    await expect(waitForAngularServices(["settingsSvc"], { intervalMs: 0, maxAttempts: 1 }))
      .rejects.toThrow("Unable to load the Angular core services.")
  })

  it("runs service work inside an Angular digest", async () => {
    const evalAsync = vi.fn(callback => callback())
    const rootScope = { $evalAsync: evalAsync }
    const injector = { get: vi.fn(() => rootScope) }
    document.body.setAttribute("ng-app", "QuepidApp")
    window.angular = { element: vi.fn(() => ({ injector: () => injector })) }

    await expect(runInAngular(() => "done")).resolves.toBe("done")
    expect(evalAsync).toHaveBeenCalledOnce()
  })

  it("publishes named capabilities without exposing a service lookup to callers", async () => {
    const services = {
      settingsSvc: { editableSettings: vi.fn() },
      caseTryNavSvc: { getCaseNo: vi.fn() },
      fieldSpecSvc: {},
      normalDocsSvc: {}
    }
    window.quepidSearch = { caseRuntime: { snapshots: services } }

    await expect(getSnapshotCapabilities()).resolves.toBe(services)
  })

  it("does not resolve the removed live-query service for controllers", async () => {
    document.body.setAttribute("ng-app", "QuepidApp")
    const services = {
      configurationSvc: {},
      userSvc: {},
      caseSvc: {},
      settingsSvc: {},
      caseTryNavSvc: {},
      scorerSvc: {}
    }
    const injector = { get: vi.fn(name => services[name]) }
    window.angular = { element: vi.fn(() => ({ injector: () => injector })) }

    const capabilities = await getBootstrapCapabilities()

    expect(capabilities).toEqual({
      configurationSvc: services.configurationSvc,
      userSvc: services.userSvc,
      caseSvc: services.caseSvc,
      settingsSvc: services.settingsSvc,
      caseTryNavSvc: services.caseTryNavSvc,
      scorerSvc: services.scorerSvc,
      docCache: undefined
    })
    expect(injector.get).not.toHaveBeenCalledWith("queriesSvc")
  })

  it("reports the named controller when a capability cannot initialize", async () => {
    await expect(getTuneRelevanceCapabilities()).rejects.toThrow(
      'Unable to load case runtime capability "tuneRelevance" for tune_relevance_controller'
    )
  }, 10000)

  it.each([
    ["bootstrap", getBootstrapCapabilities],
    ["wizard", getWizardCapabilities]
  ])("exposes the %s capability through the case runtime namespace", async (name, getter) => {
    const capability = { marker: name }
    window.quepidSearch = { caseRuntime: { [name]: capability } }

    await expect(getter()).resolves.toBe(capability)
  })
})
