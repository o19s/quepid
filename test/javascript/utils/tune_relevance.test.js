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
  mapQueryParamsSettings
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

  it("reads Qdrant's limit without rewriting the query", () => {
    const code = readFileSync("db/mapper_based_search_engines/qdrant.js", "utf8")
    const value = '{ "query": "#$query##", "limit": 250 }'
    expect(mapQueryParamsSettings(value, code, evaluateMapperFunctions)).toEqual({
      queryParams: value,
      numberOfRows: 250,
      maxNumberOfRows: null
    })
  })

  it("preserves JSON's serialized negative-zero counterexample without adding a limit", () => {
    const code = readFileSync("db/mapper_based_search_engines/qdrant.js", "utf8")
    const value = JSON.stringify({ "": -0 })
    const result = mapQueryParamsSettings(value, code, evaluateMapperFunctions, 1)
    expect(result.queryParams).toBe(value)
    expect(JSON.parse(result.queryParams)).toEqual({ "": 0 })
  })

  it("does not add a count to an empty Qdrant query object", () => {
    const code = readFileSync("db/mapper_based_search_engines/qdrant.js", "utf8")
    expect(
      JSON.parse(mapQueryParamsSettings("{}", code, evaluateMapperFunctions, 1).queryParams)
    ).toEqual({})
  })

  it.each(["", "this.docsMapper = function (data) { return data }", "invalid mapper code!"])(
    "preserves query text and default limits without a usable settings mapper: %s",
    (code) => {
      const value = '{"query": "#$query##", "limit": 10}'
      expect(mapQueryParamsSettings(value, code, evaluateMapperFunctions, 40)).toEqual({
        queryParams: value,
        maxNumberOfRows: 100
      })
    }
  )

  it.each(['{"query":', "q=test&limit=10", "null", "[1,2]"])(
    "preserves non-object or incomplete Qdrant query text when reading and writing a count: %s",
    (value) => {
      const code = readFileSync("db/mapper_based_search_engines/qdrant.js", "utf8")
      expect(mapQueryParamsSettings(value, code, evaluateMapperFunctions)).toEqual({
        queryParams: value,
        maxNumberOfRows: null
      })
      expect(mapQueryParamsSettings(value, code, evaluateMapperFunctions, 250).queryParams).toBe(
        value
      )
    }
  )

  it.each([0, -1, 1.5, "20", null])(
    "does not treat an invalid query limit as a result count: %s",
    (limit) => {
      const code = readFileSync("db/mapper_based_search_engines/qdrant.js", "utf8")
      const value = JSON.stringify({ limit })
      expect(mapQueryParamsSettings(value, code, evaluateMapperFunctions)).toEqual({
        queryParams: value,
        maxNumberOfRows: null
      })
    }
  )

  it("allows positive Qdrant counts above 100 while retaining other engines' maximum", () => {
    expect(validateNumberOfRows(250)).toBe(false)
    expect(validateNumberOfRows(250, null)).toBe(true)
    expect(validateNumberOfRows(0, null)).toBe(false)
    expect(validateNumberOfRows(1.5, null)).toBe(false)
    expect(validateNumberOfRows(Number.MAX_SAFE_INTEGER + 1, null)).toBe(false)
  })

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
