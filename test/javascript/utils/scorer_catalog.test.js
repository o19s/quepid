import { describe, expect, it, vi } from "vitest"
import { createScorerCatalog } from "utils/scorer_catalog"

describe("scorer catalog", () => {
  it("bootstraps the case default through the injected transport and factory", async () => {
    const defaultScorer = { scorerId: 1 }
    const constructed = { scorerId: 7 }
    const constructFromData = vi.fn(data => data ? constructed : defaultScorer)
    const request = vi.fn(() => Promise.resolve({ data: { default: { scorer_id: 7 } } }))
    const catalog = createScorerCatalog({
      request,
      constructFromData,
      initialDefault: defaultScorer
    })

    await catalog.bootstrap(42)

    expect(request).toHaveBeenCalledWith({ method: "GET", url: "api/cases/42/scorers" })
    expect(constructFromData).toHaveBeenCalledWith({ scorer_id: 7 })
    expect(catalog.getDefault()).toBe(constructed)
  })

  it("resets to a fresh default when the case has no configured scorer", async () => {
    const initialDefault = { scorerId: 1 }
    const freshDefault = { scorerId: undefined }
    const constructFromData = vi.fn(data => data ? { scorerId: data.scorer_id } : freshDefault)
    const catalog = createScorerCatalog({
      request: vi.fn(() => Promise.resolve({ data: {} })),
      constructFromData,
      initialDefault
    })

    await catalog.bootstrap(42)

    expect(catalog.getDefault()).toBe(freshDefault)
    expect(constructFromData).toHaveBeenCalledWith()
  })

  it("keeps default selection and factory construction framework-free", async () => {
    const promiseApi = { resolve: vi.fn(() => Promise.resolve()) }
    const scorer = { scorerId: 9 }
    const catalog = createScorerCatalog({
      request: vi.fn(),
      constructFromData: vi.fn(() => scorer),
      initialDefault: null,
      promiseApi
    })

    expect(catalog.constructFromData({ scorer_id: 9 })).toBe(scorer)
    await catalog.setDefault(scorer)

    expect(catalog.getDefault()).toBe(scorer)
    expect(promiseApi.resolve).toHaveBeenCalledOnce()
  })
})
