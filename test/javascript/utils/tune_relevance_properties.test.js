import { readFileSync } from "node:fs"
import { evaluateMapperFunctions } from "utils/query_service"
import fc from "fast-check"
import { expect, it } from "vitest"
import { fieldSpecTokens, withoutEngineManagedLimit } from "utils/tune_relevance"

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

it("Qdrant hides only the top-level limit and preserves all other JSON fields", () => {
  const code = readFileSync("db/mapper_based_search_engines/qdrant.js", "utf8")
  fc.assert(
    fc.property(fc.dictionary(fc.string(), fc.jsonValue()), fc.integer(), (fields, limit) => {
      const query = { ...fields, limit }
      const expected = { ...fields }
      delete expected.limit
      const result = withoutEngineManagedLimit(JSON.stringify(query), code, evaluateMapperFunctions)
      expect(JSON.parse(result)).toEqual(expected)
      expect(withoutEngineManagedLimit(result, code, evaluateMapperFunctions)).toBe(result)
    })
  )
})
