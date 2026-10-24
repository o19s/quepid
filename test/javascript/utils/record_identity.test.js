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

describe("isSameId missing ids", () => {
  it("never matches when either side is missing, nor against its string spelling", () => {
    expect(isSameId(null, 1)).toBe(false)
    expect(isSameId(1, undefined)).toBe(false)
    expect(isSameId(undefined, 1)).toBe(false)
    expect(isSameId("", "")).toBe(false)
    expect(isSameId(0, "0")).toBe(true)
    expect(isSameId(null, "null")).toBe(false)
    expect(isSameId("null", null)).toBe(false)
    expect(isSameId(undefined, "undefined")).toBe(false)
    expect(isSameId("undefined", undefined)).toBe(false)
  })
})
