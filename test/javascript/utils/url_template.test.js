import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fillUrlTemplate } from "utils/url_template"

describe("fillUrlTemplate", () => {
  it("fills every placeholder, including repeats", () => {
    expect(
      fillUrlTemplate("/api/teams/__TEAM_ID__/cases/__CASE_ID__?from=__CASE_ID__", {
        TEAM_ID: 3,
        CASE_ID: "7"
      })
    ).toBe("/api/teams/3/cases/7?from=7")
  })

  it("stringifies booleans and zero", () => {
    expect(
      fillUrlTemplate("/r/__BOOK_ID__?background=__BACKGROUND__&missing=__CREATE_MISSING__", {
        BOOK_ID: 0,
        BACKGROUND: true,
        CREATE_MISSING: false
      })
    ).toBe("/r/0?background=true&missing=false")
  })

  it("encodes each value as a URI component", () => {
    expect(fillUrlTemplate("/q/__QUERY_ID__", { QUERY_ID: "a/b c?d" })).toBe("/q/a%2Fb%20c%3Fd")
  })

  it("does not fill placeholders that appear inside a value", () => {
    expect(fillUrlTemplate("/a/__A__/b/__B__", { A: "__B__", B: 2 })).toBe("/a/__B__/b/2")
  })

  it("returns a template without placeholders unchanged", () => {
    expect(fillUrlTemplate("/api/cases", {})).toBe("/api/cases")
  })

  describe("when the template and the values disagree", () => {
    beforeEach(() => {
      vi.spyOn(console, "error").mockImplementation(() => {})
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    // The message reaches users; the detail only reaches the console.
    it.each([
      [
        "a placeholder with no value",
        "/api/cases/__CASE_ID__/scorers/__SCORER_ID__",
        { CASE_ID: 1 },
        "/api/cases/__CASE_ID__/scorers/__SCORER_ID__ has no value for __SCORER_ID__"
      ],
      [
        "a value with no placeholder",
        "/api/cases/__CASE_ID__",
        { CASE_ID: 1, QUERY_ID: 2 },
        "has no placeholder for QUERY_ID"
      ],
      ["a null value", "/api/cases/__CASE_ID__", { CASE_ID: null }, "got a missing value"],
      [
        "an undefined value",
        "/api/cases/__CASE_ID__",
        { CASE_ID: undefined },
        "got a missing value"
      ],
      ["an empty value", "/api/cases/__CASE_ID__", { CASE_ID: "" }, "got a missing value"]
    ])("rejects %s", (_case, template, values, detail) => {
      expect(() => fillUrlTemplate(template, values)).toThrow(new Error("Invalid request URL"))
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining(detail))
    })
  })
})
