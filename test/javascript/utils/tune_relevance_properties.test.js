import fc from "fast-check"
import { expect, it } from "vitest"
import { fieldSpecTokens } from "utils/tune_relevance"

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
