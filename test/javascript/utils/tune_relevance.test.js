import { describe, expect, it } from "vitest"
import {
  customHeadersForType,
  curatorVariableEntries,
  formatJson,
  queryParamsMode,
  queryParamsWarning,
  urlBucket,
  validateNumberOfRows
} from "utils/tune_relevance"

describe("tune relevance utilities", () => {
  it("detects JSON query params without rejecting plain query syntax", () => {
    expect(queryParamsMode('{"q":"law"}')).toBe("json")
    expect(queryParamsMode("q=law")).toBe("text")
  })

  it("reports common Solr parameter typos", () => {
    expect(queryParamsWarning("deftype=edismax")).toContain("defType")
    expect(queryParamsWarning("q=law")).toBe("")
  })

  it("formats valid JSON and rejects invalid JSON", () => {
    expect(formatJson('{"q":"law"}')).toBe('{\n  "q": "law"\n}')
    expect(formatJson("q=law")).toBeNull()
  })

  it("validates the result count bounds", () => {
    expect(validateNumberOfRows(1)).toBe(true)
    expect(validateNumberOfRows(100)).toBe(true)
    expect(validateNumberOfRows(0)).toBe(false)
    expect(validateNumberOfRows(1.5)).toBe(false)
  })

  it("creates the same header presets as the legacy editor", () => {
    expect(customHeadersForType("None")).toBe("")
    expect(customHeadersForType("API Key")).toContain("Authorization")
    expect(customHeadersForType("Custom")).toContain("KEY")
  })

  it("groups endpoint URLs into three history buckets", () => {
    expect(urlBucket("a", ["a", "b", "c"])).toBe(0)
    expect(urlBucket("c", ["a", "b", "c"])).toBe(2)
  })

  it("keeps original indexes for filtered curator variables", () => {
    const variables = [{ name: "unused", inQueryParams: false }, { name: "boost", inQueryParams: true }]
    expect(curatorVariableEntries(variables)).toEqual([{ item: variables[1], index: 1 }])
  })
})
