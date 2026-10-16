import { describe, expect, it } from "vitest"
import { formatShortDate } from "utils/date_format"

describe("snapshot short dates", () => {
  it.each([null, undefined, "", "invalid", new Date(NaN)])("suppresses missing or invalid dates: %s", value => {
    expect(formatShortDate(value)).toBe("")
  })

  it.each(["2026-01-01T00:30:00Z", "2026-12-31T23:30:00-08:00", "0001-02-03T12:00:00Z", "0100-02-03T12:00:00Z", "-000001-02-03T12:00:00Z"])("matches Intl in the local timezone for %s", value => {
    const expected = new Date(value).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" })
    expect(formatShortDate(value)).toBe(expected)
  })

  it("pads a one-digit year", () => {
    expect(formatShortDate("0001-02-03T12:00:00")).toBe("2/3/01")
  })
})
