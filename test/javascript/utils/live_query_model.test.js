import { describe, expect, it, vi } from "vitest"
import { createLiveQueryModelRuntime } from "utils/live_query_model"

describe("live query model runtime", () => {
  it("assembles the query model from the injected case adapters", () => {
    const createModel = vi.fn(() => ({ state: "model" }))
    const adapters = {
      createModel,
      getDefaultScorer: vi.fn(),
      scoreQuery: vi.fn(),
      getFieldSpec: vi.fn(),
      getQueryState: vi.fn(),
      buildRatingsFilter: vi.fn(),
      ratedDocIds: vi.fn(),
      onDirty: vi.fn(),
      publish: vi.fn()
    }
    const runtime = createLiveQueryModelRuntime(adapters)
    const query = { queryId: 7 }
    const ratingsStore = { version: vi.fn() }

    expect(runtime.create({ query, ratingsStore })).toEqual({ state: "model" })
    expect(createModel).toHaveBeenCalledWith({
      query,
      ratingsStore,
      getDefaultScorer: adapters.getDefaultScorer,
      scoreQuery: adapters.scoreQuery,
      getFieldSpec: adapters.getFieldSpec,
      getQueryState: expect.any(Function),
      buildRatingsFilter: adapters.buildRatingsFilter,
      ratedDocIds: adapters.ratedDocIds,
      onDirty: adapters.onDirty,
      publish: adapters.publish
    })
    expect(createModel.mock.calls[0][0].getQueryState()).toBe(adapters.getQueryState(query))
  })

  it("uses the framework-free query model by default", () => {
    const runtime = createLiveQueryModelRuntime({
      getDefaultScorer: () => ({ name: "default" }),
      scoreQuery: vi.fn(),
      getFieldSpec: () => ({ id: "id" }),
      getQueryState: () => ({ state: "loaded" }),
      buildRatingsFilter: vi.fn(),
      ratedDocIds: vi.fn(),
      onDirty: vi.fn(),
      publish: vi.fn()
    })

    expect(runtime.create({ query: { queryId: 1 }, ratingsStore: { version: () => 0 } })).toHaveProperty("score")
  })
})
