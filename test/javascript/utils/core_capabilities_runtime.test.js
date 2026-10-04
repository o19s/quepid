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

  it("uses the injected scheduler", () => {
    const schedule = vi.fn(callback => callback())
    const framework = createNativeFramework({ schedule })
    const callback = vi.fn()
    framework.schedule(callback)
    expect(callback).toHaveBeenCalledOnce()
    expect(schedule).toHaveBeenCalledWith(callback)
    expect(framework).not.toHaveProperty("applyAsync")
  })

  it("publishes named capabilities without exposing a service lookup to callers", async () => {
    const services = {
      settings: { editableSettings: vi.fn() },
      navigation: { getCaseNo: vi.fn() },
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
      navigation: expect.any(Object)
    }))
    expect(capabilities.core).not.toHaveProperty("scoring")
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
