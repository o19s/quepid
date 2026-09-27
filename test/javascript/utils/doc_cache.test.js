import { describe, expect, it, vi } from "vitest"
import { createDocCache } from "utils/doc_cache"

describe("createDocCache", () => {
  it("tracks shared and snapshot-scoped documents independently", async () => {
    const fetchDocs = vi.fn().mockImplementation(function () {
      this.docs = [{ id: "one", title: "One" }]
      return Promise.resolve()
    })
    const resolver = vi.fn().mockReturnValue({ fetchDocs, docs: [] })
    const cache = createDocCache({ resolver, proxyUrlFor: (id) => `/proxy/${id}` })

    cache.addIds(["one"])
    cache.addIds(["one"], "snapshot-1")
    expect(cache.knowsDoc("one")).toBe(true)
    expect(cache.hasDoc("one")).toBe(false)

    await cache.update({ proxyRequests: true, searchEndpointId: 4 })
    expect(cache.getDoc("one")).toEqual({ id: "one", title: "One" })
    expect(resolver).toHaveBeenCalledWith(["one"], {
      proxyRequests: true,
      searchEndpointId: 4,
      proxyUrl: "/proxy/4"
    }, 15)

    cache.empty("snapshot-1")
    expect(cache.knowsDoc("one", "snapshot-1")).toBe(false)
  })

  it("invalidates only the selected scope", () => {
    const cache = createDocCache({ resolver: vi.fn(), proxyUrlFor: vi.fn() })
    cache.addIds(["shared"])
    cache.addIds(["scoped"], "snapshot-1")
    cache.invalidate("snapshot-1")

    expect(cache.hasDoc("shared")).toBe(false)
    expect(cache.hasDoc("scoped", "snapshot-1")).toBe(false)
  })
})
