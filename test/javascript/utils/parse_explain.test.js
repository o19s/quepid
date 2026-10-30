import { describe, expect, it } from "vitest"
import { parseExplain } from "utils/parse_explain"

describe("parseExplain", () => {
  it("parses JSON and preserves existing values", () => {
    expect(parseExplain('{"value":2}')).toEqual({ value: 2 })
    const explain = { value: 3 }
    expect(parseExplain(explain)).toBe(explain)
    expect(parseExplain(null)).toBeNull()
    expect(parseExplain(undefined)).toBeUndefined()
  })

  it("surfaces malformed serialized explains", () => {
    expect(() => parseExplain("invalid JSON")).toThrow(SyntaxError)
  })
})
