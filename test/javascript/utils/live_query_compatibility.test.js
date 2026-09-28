import { describe, expect, it, vi } from "vitest"
import { createLiveQueryCompatibilityRuntime } from "utils/live_query_compatibility"

describe("createLiveQueryCompatibilityRuntime", () => {
  it("wires model, document, factory, and execution runtimes through shared adapters", () => {
    const modelRuntime = { create: vi.fn() }
    const documentRuntime = {
      createDocList: vi.fn(),
      setDocs: vi.fn(),
      setError: vi.fn()
    }
    const executionRuntime = { create: vi.fn(() => "execution") }
    const factoryRuntime = { create: vi.fn(() => "factory") }
    const model = { create: vi.fn(() => modelRuntime) }
    const documents = { create: vi.fn(() => documentRuntime) }
    const execution = { create: executionRuntime.create }
    const factory = { create: factoryRuntime.create }
    const publish = vi.fn()
    const modelOptions = { scoreQuery: vi.fn() }
    const documentOptions = { matchFeaturesExplain: vi.fn() }

    const runtime = createLiveQueryCompatibilityRuntime({
      model,
      factory,
      documents,
      execution,
      factoryOptions: {
        model: modelOptions,
        documents: documentOptions,
        factory: { getCaseNo: vi.fn() },
        publish
      },
      executionOptions: {
        settings: { get: vi.fn(), copy: vi.fn() },
        documents: { createRateable: vi.fn() },
        searchers: { create: vi.fn() },
        errors: { parse: vi.fn() },
        publish
      }
    })

    expect(runtime).toEqual({
      model: modelRuntime,
      documents: documentRuntime,
      execution: "execution",
      factory: "factory"
    })
    expect(model.create).toHaveBeenCalledWith({ ...modelOptions, publish })
    expect(documents.create).toHaveBeenCalledWith({ ...documentOptions, publish })
    expect(factory.create).toHaveBeenCalledWith({
      getCaseNo: expect.any(Function),
      createModel: expect.any(Function),
      publish
    })
    expect(executionRuntime.create).toHaveBeenCalledWith(expect.objectContaining({
      documents: expect.objectContaining({
        createList: documentOptions.createDocList,
        setDocs: documentRuntime.setDocs,
        onError: documentRuntime.setError,
        matchFeaturesExplain: documentOptions.matchFeaturesExplain
      })
    }))
    expect(executionRuntime.create).toHaveBeenCalledWith(expect.objectContaining({
      errors: expect.objectContaining({ onError: documentRuntime.setError })
    }))
  })
})
