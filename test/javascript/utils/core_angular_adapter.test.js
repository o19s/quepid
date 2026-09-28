import { afterEach, describe, expect, it, vi } from "vitest"
import {
  getBootstrapCapabilities,
  getSnapshotCapabilities,
  getTuneRelevanceCapabilities,
  getWizardCapabilities,
  createNativeFramework,
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
    const services = { $rootScope: { name: "root" }, ScorerFactory: { name: "scorer" } }
    const injector = { get: vi.fn(name => services[name]) }
    window.angular = { element: vi.fn(() => ({ injector: () => injector })) }

    await expect(waitForAngularServices(["$rootScope", "ScorerFactory"])).resolves.toEqual(services)
    expect(injector.get).toHaveBeenCalledWith("$rootScope")
    expect(injector.get).toHaveBeenCalledWith("ScorerFactory")
  })

  it("preserves mounted paths, serialized bodies, and failed-request rejection", async () => {
    document.head.innerHTML = '<base href="/quepid-app/">'
    const rootScope = { $evalAsync: vi.fn(), $applyAsync: vi.fn() }
    const framework = createNativeFramework(rootScope)
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ saved: true }), { status: 200, statusText: "OK" })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "nope" }), { status: 422, statusText: "Unprocessable Entity" })
      )

    await framework.request({
      method: "DELETE",
      url: "api/cases/1/ratings",
      data: JSON.stringify({ rating: { doc_id: "doc-1" } })
    })

    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:3000/quepid-app/api/cases/1/ratings")
    expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify({ rating: { doc_id: "doc-1" } }))
    await expect(framework.request({ url: "api/cases/1/queries" })).rejects.toMatchObject({
      data: { error: "nope" },
      status: 422,
      ok: false
    })
  })

  it("rejects when Angular never becomes available", async () => {
    await expect(waitForAngularServices(["missingService"], { intervalMs: 0, maxAttempts: 1 }))
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
      $rootScope: { $evalAsync: vi.fn(), $applyAsync: vi.fn() },
      $http: Object.assign(vi.fn(), { get: vi.fn() }),
      $q: { reject: vi.fn(), resolve: vi.fn() },
      $log: {},
      caseSvc: {},
      settingsSvc: {},
      caseTryNavSvc: {},
      ScorerFactory: vi.fn()
    }
    const injector = { get: vi.fn(name => services[name]) }
    window.angular = { element: vi.fn(() => ({ injector: () => injector })) }

    const capabilities = await getBootstrapCapabilities()

    expect(capabilities).toEqual(expect.objectContaining({
      core: expect.any(Object),
      docCache: undefined,
      liveQuery: expect.any(Object)
    }))
    expect(capabilities.core).toEqual(expect.objectContaining({
      configuration: expect.any(Object),
      user: expect.any(Object),
      case: expect.any(Object),
      settings: expect.any(Object),
      navigation: expect.any(Object),
      scoring: expect.any(Object)
    }))
    expect(capabilities.liveQuery).toEqual({
      framework: expect.any(Object),
      domain: expect.any(Object)
    })
    expect(injector.get).not.toHaveBeenCalledWith("queriesSvc")
    expect(injector.get).not.toHaveBeenCalledWith("configurationSvc")
    expect(injector.get).not.toHaveBeenCalledWith("caseTryNavSvc")
    expect(injector.get).not.toHaveBeenCalledWith("$http")
    expect(injector.get).not.toHaveBeenCalledWith("$q")
    expect(injector.get).not.toHaveBeenCalledWith("$log")
  })

  it("reports the named controller when a capability cannot initialize", async () => {
    await expect(getBootstrapCapabilities()).rejects.toThrow(
      'Unable to load case runtime capability "bootstrap" for core_bootstrap_controller'
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

  it("publishes named groups for snapshot, wizard, and tune capabilities", async () => {
    document.body.setAttribute("ng-app", "QuepidApp")
    const services = {}
    const injector = { get: vi.fn(name => services[name]) }
    window.angular = { element: vi.fn(() => ({ injector: () => injector })) }

    const [snapshots, wizard, tuneRelevance] = await Promise.all([
      getSnapshotCapabilities(),
      getWizardCapabilities(),
      getTuneRelevanceCapabilities()
    ])

    expect(snapshots.capability).toEqual(expect.objectContaining({
      settings: expect.any(Object),
      navigation: expect.any(Object),
      fieldSpec: expect.any(Object),
      documents: expect.any(Object)
    }))
    expect(wizard.capability).toEqual(expect.objectContaining({
      settings: expect.any(Object),
      case: expect.any(Object),
      endpoints: expect.any(Object),
      mapper: expect.any(Object),
      search: expect.any(Object),
      user: expect.any(Object),
      navigation: expect.any(Object),
      documents: expect.any(Object)
    }))
    expect(tuneRelevance.capability).toEqual(expect.objectContaining({
      settings: expect.any(Object),
      endpoints: expect.any(Object),
      search: expect.any(Object),
      case: expect.any(Object),
      navigation: expect.any(Object)
    }))
    expect(injector.get).not.toHaveBeenCalledWith("fieldSpecSvc")
    expect(injector.get).not.toHaveBeenCalledWith("normalDocsSvc")
    expect(injector.get).not.toHaveBeenCalledWith("searchSvc")
    expect(injector.get).not.toHaveBeenCalledWith("esUrlSvc")
  })

  it("preserves the wizard completion request on the user capability", async () => {
    document.body.setAttribute("ng-app", "QuepidApp")
    const services = {}
    const injector = { get: vi.fn(name => services[name]) }
    window.angular = { element: vi.fn(() => ({ injector: () => injector })) }

    const { capability } = await getWizardCapabilities()

    expect(capability.user.shownIntroWizard).toEqual(expect.any(Function))
  })
})
