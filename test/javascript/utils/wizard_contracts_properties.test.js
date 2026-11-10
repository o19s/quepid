import fc from "fast-check"
import { expect, it } from "vitest"
import { searchApiValidationArgs } from "utils/wizard_contracts"

it("round trips Vespa JSON arguments including whitespace and pagination fields", () => {
  fc.assert(
    fc.property(
      fc.dictionary(fc.string(), fc.jsonValue()),
      fc.constantFrom("", " ", "\n  "),
      (args, prefix) => {
        const value = prefix + JSON.stringify(args)
        expect(searchApiValidationArgs(value, "yql")).toEqual(args)
        expect(searchApiValidationArgs(value, undefined)).toBe(value)
      }
    )
  )
})
