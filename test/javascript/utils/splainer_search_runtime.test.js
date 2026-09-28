import { describe, expect, it, vi } from "vitest"
import { createSplainerSearchRuntime } from "utils/splainer_search_runtime"

describe("splainer search runtime", () => {
  it("publishes the wired services without an Angular promise adapter", () => {
    const services = { docResolverSvc: { createResolver: vi.fn() }, searchSvc: {} }
    const wire = vi.fn(() => services)
    const client = { search: vi.fn() }

    const runtime = createSplainerSearchRuntime({ client, wire })

    expect(wire).toHaveBeenCalledWith(client)
    expect(runtime.services).toBe(services)
    expect(runtime.docResolverSvc).toBe(services.docResolverSvc)
  })

  it("keeps the wired service methods native instead of requiring Angular", () => {
    const search = vi.fn(() => Promise.resolve({ docs: [] }))
    const services = { searchSvc: { search }, docResolverSvc: {} }
    const runtime = createSplainerSearchRuntime({ wire: () => services })

    expect(runtime.services.searchSvc.search()).toBeInstanceOf(Promise)
    expect(search).toHaveBeenCalledOnce()
  })
})
