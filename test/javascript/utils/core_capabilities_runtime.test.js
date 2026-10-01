import { afterEach, describe, expect, it, vi } from "vitest"
import {
  getBootstrapCapabilities,
  getSnapshotCapabilities,
  getTuneRelevanceCapabilities,
  getWizardCapabilities,
  createNativeFramework,
  resetCoreServiceCache
} from "utils/core_capabilities_runtime"

describe("core runtime capabilities", () => {
  afterEach(() => {
    delete window.quepidSearch
    document.body.innerHTML = ""
    resetCoreServiceCache()
    vi.restoreAllMocks()
  })

  it("preserves mounted paths, serialized bodies, and failed-request rejection", async () => {
    document.head.innerHTML = '<base href="/quepid-app/">'
    const framework = createNativeFramework()
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
    const failure = await framework.request({ url: "api/cases/1/queries" }).catch((error) => error)
    expect(failure).toBeInstanceOf(Error)
    expect(failure).toMatchObject({ data: { error: "nope" }, status: 422, ok: false })
  })

  it("builds query params, JSON bodies, and headers for native requests", async () => {
    document.head.innerHTML = '<base href="/">'
    const framework = createNativeFramework()
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ ok: 1 }), { status: 200, statusText: "OK" })))

    const result = await framework.request({
      method: "POST",
      url: "api/things",
      params: { page: 2, skipNull: null, skipUndefined: undefined, zero: 0 },
      headers: { "X-Trace": "t" },
      data: { name: "a" }
    })
    await framework.request({ url: "api/things", headers: { "Content-Type": "text/plain" }, data: "raw" })
    await framework.get("api/other")

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("http://localhost:3000/api/things?page=2&zero=0")
    expect(init.method).toBe("POST")
    expect(init.body).toBe('{"name":"a"}')
    expect(init.headers).toMatchObject({ "X-Trace": "t", "Content-Type": "application/json" })
    expect(result).toEqual({ data: { ok: 1 }, ok: true, status: 200, statusText: "OK" })

    const [, plainInit] = fetchMock.mock.calls[1]
    expect(plainInit.method).toBe("GET")
    expect(plainInit.headers["Content-Type"]).toBe("text/plain")
    expect(plainInit.body).toBe("raw")

    const [getUrl, getInit] = fetchMock.mock.calls[2]
    expect(getUrl).toBe("http://localhost:3000/api/other")
    expect(getInit.method).toBe("GET")
    expect(getInit.body).toBeUndefined()
    expect(getInit.headers).not.toHaveProperty("Content-Type")
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
    const capabilities = await getBootstrapCapabilities()

    expect(capabilities).toEqual(expect.objectContaining({
      core: expect.any(Object),
      docCache: expect.any(Object),
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
      create: expect.any(Function),
      framework: expect.any(Object),
      domain: expect.any(Object)
    })
  })

  it.each([
    ["bootstrap", getBootstrapCapabilities],
    ["wizard", getWizardCapabilities]
  ])("exposes the %s capability through the case runtime namespace", async (name, getter) => {
    const capability = { marker: name }
    window.quepidSearch = { caseRuntime: { [name]: capability } }

    await expect(getter()).resolves.toBe(capability)
  })

  it("publishes named groups for snapshot, wizard, and tune capabilities", async () => {
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
  })

  it("preserves the wizard completion request on the user capability", async () => {
    const { capability } = await getWizardCapabilities()

    expect(capability.user.shownIntroWizard).toEqual(expect.any(Function))
  })
})
