import { readFileSync } from "node:fs"
import { evaluateMapperFunctions } from "utils/query_service"
import { describe, expect, it } from "vitest"
import {
  curatorVariableEntries,
  fieldSpecTokens,
  formatJson,
  historyTitle,
  queryParamsMode,
  queryParamsWarning,
  urlBucket,
  validateNumberOfRows,
  withoutEngineManagedLimit
} from "utils/tune_relevance"

describe("tune relevance utilities", () => {
  it("detects JSON query params without rejecting plain query syntax", () => {
    expect(queryParamsMode('{"q":"law"}')).toBe("json")
    expect(queryParamsMode("q=law")).toBe("text")
  })

  it("reports common Solr parameter typos", () => {
    expect(queryParamsWarning("deftype=edismax")).toEqual({
      typo: "deftype",
      correction: "defType"
    })
    expect(queryParamsWarning("q=law&timeallowed=5&omitheader=true")).toEqual({
      typo: "omitheader",
      correction: "omitHeader"
    })
    expect(queryParamsWarning("defType=edismax")).toBeNull()
    expect(queryParamsWarning("q=law")).toBeNull()
    expect(queryParamsWarning(undefined)).toBeNull()
  })

  it("formats valid JSON and rejects invalid JSON", () => {
    expect(formatJson('{"q":"law"}')).toBe('{\n  "q": "law"\n}')
    expect(formatJson("q=law")).toBeNull()
  })

  it("uses Qdrant's mapper to hide the managed limit", () => {
    const code = readFileSync("db/mapper_based_search_engines/qdrant.js", "utf8")
    expect(
      withoutEngineManagedLimit(
        '{"query": "#$query##", "limit": 10}',
        code,
        evaluateMapperFunctions
      )
    ).toBe('{\n  "query": "#$query##"\n}')
  })

  it("removes a zero limit from an otherwise empty object", () => {
    const code = readFileSync("db/mapper_based_search_engines/qdrant.js", "utf8")
    expect(withoutEngineManagedLimit('{"limit":0}', code, evaluateMapperFunctions)).toBe("{}")
  })

  it.each(["", "this.docsMapper = function (data) { return data }", "invalid mapper code!"])(
    "leaves query text unchanged without a usable display mapper: %s",
    (code) => {
      const value = '{"query": "#$query##", "limit": 10}'
      expect(withoutEngineManagedLimit(value, code, evaluateMapperFunctions)).toBe(value)
    }
  )

  it.each(['{"query":', "q=test&limit=10", "null", "[1,2]", '{ "query": 1 }'])(
    "preserves Qdrant query text that has no removable object limit: %s",
    (value) => {
      const code = readFileSync("db/mapper_based_search_engines/qdrant.js", "utf8")
      expect(withoutEngineManagedLimit(value, code, evaluateMapperFunctions)).toBe(value)
    }
  )

  it("validates the result count bounds", () => {
    expect(validateNumberOfRows(1)).toBe(true)
    expect(validateNumberOfRows(100)).toBe(true)
    expect(validateNumberOfRows(0)).toBe(false)
    expect(validateNumberOfRows(1.5)).toBe(false)
  })

  it("groups endpoint URLs into three history buckets", () => {
    expect(urlBucket("a", ["a", "b", "c"])).toBe(0)
    expect(urlBucket("c", ["a", "b", "c"])).toBe(2)
  })

  it("titles a history row with its search URL and one name=value line per knob", () => {
    expect(
      historyTitle({
        searchUrl: "http://s/select",
        curatorVars: [
          { name: "boost", value: 2 },
          { name: "tie", value: 0.1 }
        ]
      })
    ).toBe("http://s/select\nboost=2\ntie=0.1\n")
    expect(historyTitle({ searchUrl: "http://s/select" })).toBe("http://s/select\n")
    expect(historyTitle({})).toBe("\n")
  })

  it("keeps original indexes for filtered curator variables", () => {
    const variables = [
      { name: "unused", inQueryParams: false },
      { name: "boost", inQueryParams: true }
    ]
    expect(curatorVariableEntries(variables)).toEqual([{ item: variables[1], index: 1 }])
  })
})

it("keeps repeated JSON field types together instead of splitting/deduplicating their fragments", () => {
  const fields = [
    '{"type":"thumb","name":"poster_path"}',
    '{"type":"thumb","name":"backdrop_path"}'
  ]
  expect(fieldSpecTokens(`id:id ${fields.join(" ")}`)).toEqual(["id:id", ...fields])
})

it("preserves the shrunk nested-options counterexample", () => {
  const definition = '{"type":"thumb","name":"poster_path","options":{}}'
  expect(fieldSpecTokens(definition)).toEqual([definition])
})
