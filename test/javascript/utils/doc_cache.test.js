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

describe("createDocCache resolved docs", () => {
  const build = () => {
    const resolver = vi.fn((ids) => ({
      fetchDocs() {
        this.docs = ids.map((id) => ({ id }))
        return Promise.resolve()
      },
      docs: []
    }))
    return { resolver, cache: createDocCache({ resolver, proxyUrlFor: () => "/p" }) }
  }

  it("treats null and undefined scope as the shared cache", () => {
    const { cache } = build()
    cache.addIds(["a"], null)
    expect(cache.knowsDoc("a")).toBe(true)
    expect(cache.knowsDoc("a", undefined)).toBe(true)
    cache.empty(null)
    expect(cache.knowsDoc("a")).toBe(false)
    cache.addIds(["a"])
    cache.empty()
    expect(cache.knowsDoc("a")).toBe(false)
  })

  it("invalidate discards resolved docs so they are fetched again", async () => {
    const { cache, resolver } = build()
    cache.addIds(["a"])
    cache.addIds(["a"], 5)
    await cache.update({})
    await cache.update({}, 5)
    expect(cache.hasDoc("a")).toBe(true)

    cache.invalidate()
    expect(cache.hasDoc("a")).toBe(false)
    expect(cache.knowsDoc("a")).toBe(true)
    expect(cache.hasDoc("a", 5)).toBe(true)

    resolver.mockClear()
    await cache.update({})
    expect(resolver).toHaveBeenCalledTimes(1)
  })

  it("does not refetch docs that are already resolved and keeps them when ids are re-added", async () => {
    const { cache, resolver } = build()
    cache.addIds(["a"])
    await cache.update({})
    cache.addIds(["a"])
    expect(cache.hasDoc("a")).toBe(true)
    resolver.mockClear()
    await cache.update({})
    expect(resolver).not.toHaveBeenCalled()
  })

  it("only adds a proxy url when proxyRequests is true", async () => {
    const { cache, resolver } = build()
    cache.addIds(["a"])
    await cache.update({ proxyRequests: false, searchEndpointId: 1 })
    expect(resolver.mock.calls[0][1]).not.toHaveProperty("proxyUrl")
  })
})
