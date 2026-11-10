import { readFileSync } from "node:fs"
import { evaluateMapperFunctions } from "utils/query_service"
import fc from "fast-check"
import { expect, it } from "vitest"
import { fieldSpecTokens, mapQueryParamsSettings } from "utils/tune_relevance"

it("preserves whole JSON definitions and their order across separator round trips", () => {
  const field = fc.oneof(
    fc.constantFrom("id:id", "title:title", "overview", "thumb:poster_path"),
    fc.jsonValue().map((options) => JSON.stringify({ type: "thumb", name: "poster_path", options }))
  )
  fc.assert(
    fc.property(
      fc.array(field, { maxLength: 20 }),
      fc.constantFrom(" ", ", ", "\n", "+"),
      (fields, separator) => {
        expect(fieldSpecTokens(fields.join(separator))).toEqual(fields)
      }
    )
  )
})

it("Qdrant query/count synchronization preserves other fields and round trips the count", () => {
  const code = readFileSync("db/mapper_based_search_engines/qdrant.js", "utf8")
  fc.assert(
    fc.property(
      fc.dictionary(fc.string(), fc.jsonValue()),
      fc.integer({ min: 1, max: 1000000 }),
      fc.boolean(),
      (fields, limit, withLimit) => {
        delete fields.limit
        const original = withLimit ? { ...fields, limit: 10 } : fields
        const value = JSON.stringify(original)
        const written = mapQueryParamsSettings(value, code, evaluateMapperFunctions, limit)
        const expected = JSON.parse(value)
        if (withLimit) expected.limit = limit
        expect(JSON.parse(written.queryParams)).toEqual(expected)
        if (!withLimit) expect(written.queryParams).toBe(value)
        const read = mapQueryParamsSettings(written.queryParams, code, evaluateMapperFunctions)
        expect(read.numberOfRows).toBe(withLimit ? limit : undefined)
        expect(read.queryParams).toBe(written.queryParams)
        expect(
          mapQueryParamsSettings(read.queryParams, code, evaluateMapperFunctions, limit).queryParams
        ).toBe(read.queryParams)
      }
    )
  )
})
