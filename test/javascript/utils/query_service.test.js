import { describe, expect, it, vi } from "vitest"
import {
  evaluateMapperFunctions,
  matchFeaturesExplain,
  pAll,
  settingsWithTryOverrides
} from "utils/query_service"

describe("query service helpers", () => {
  it("overlays selected try settings without mutating either input", () => {
    const settings = { selectedTry: { searchEngine: "solr", args: { q: "old" } }, numberOfRows: 10 }
    const result = settingsWithTryOverrides(settings, { args: { q: "new" } })

    expect(result).toEqual({ selectedTry: { searchEngine: "solr", args: { q: "new" } }, numberOfRows: 10 })
    expect(settings.selectedTry.args.q).toBe("old")
  })

  it("evaluates mapper code once per cache key and exposes recognized functions", () => {
    const cache = {}
    const globalObject = {}
    const code = "this.docsMapper = function (docs) { return docs }"

    const first = evaluateMapperFunctions(code, cache, globalObject)
    const second = evaluateMapperFunctions(code, cache, globalObject)

    expect(first.docsMapper).toBeTypeOf("function")
    expect(first.numberOfResultsMapper).toBeUndefined()
    expect(second).toBe(first)
  })

  it("builds the synthetic match-feature explain tree", () => {
    expect(matchFeaturesExplain({ fields: { score: 4 }, matchfeatures: { title: 3, body: 1 } })).toEqual({
      description: "sum of matched fields:",
      value: 4,
      details: [
        { description: "title", value: 3, details: [] },
        { description: "body", value: 1, details: [] }
      ]
    })
    expect(matchFeaturesExplain({ matchfeatures: {} })).toBeUndefined()
  })

  it("runs an unrestricted queue with bounded concurrency", async () => {
    const calls = []
    const queue = Array.from({ length: 12 }, (_, index) => async () => {
      calls.push(index)
      return index
    })

    await expect(pAll(queue, 0)).resolves.toEqual([...Array(12).keys()])
    expect(calls).toHaveLength(12)
  })

  it("runs a rate-limited queue sequentially", async () => {
    vi.useFakeTimers()
    const calls = []
    const promise = pAll(
      [
        async () => calls.push(1),
        async () => calls.push(2),
        async () => calls.push(3)
      ],
      60000
    )

    await vi.runAllTimersAsync()
    await expect(promise).resolves.toEqual([1, 2, 3])
    expect(calls).toEqual([1, 2, 3])
    vi.useRealTimers()
  })
})
