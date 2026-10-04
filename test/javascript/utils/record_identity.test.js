import { describe, expect, it } from "vitest"
import { isSameId } from "utils/record_identity"

describe("isSameId", () => {
  it("matches the same id across numbers and strings", () => {
    expect(isSameId(7, 7)).toBe(true)
    expect(isSameId("7", 7)).toBe(true)
    expect(isSameId("eider-001", "eider-001")).toBe(true)
  })

  it("does not match different ids", () => {
    expect(isSameId(7, 8)).toBe(false)
    expect(isSameId("eider-001", "eider-002")).toBe(false)
  })

  it.each([
    [undefined, undefined],
    [null, null],
    ["", ""],
    [undefined, 7],
    [7, null]
  ])("never matches a missing id (%s, %s)", (a, b) => {
    expect(isSameId(a, b)).toBe(false)
  })
})
