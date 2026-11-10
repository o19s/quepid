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
        // JSON itself has no negative-zero notation (JSON.stringify(-0) === "0"), so -0 in a
        // fast-check-generated value can never survive a real round trip; normalize through
        // the same JSON.stringify/parse pass before comparing, rather than against args as-is.
        const roundTripped = JSON.parse(JSON.stringify(args))
        expect(searchApiValidationArgs(value, "yql")).toEqual(roundTripped)
        expect(searchApiValidationArgs(value, undefined)).toBe(value)
      }
    )
  )
})
