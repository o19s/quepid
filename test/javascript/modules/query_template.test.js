import { describe, it, expect } from "vitest"
import { hydrate } from "../../../app/javascript/modules/query_template"

describe("query_template hydrate", () => {
  it("replaces #$query## with the query text", () => {
    const result = hydrate("q=#$query##", "star wars")
    expect(result).toBe("q=star wars")
  })

  it("replaces keyword placeholders", () => {
    const result = hydrate("#$keyword1## OR #$keyword2##", "star wars")
    expect(result).toBe("star OR wars")
  })

  it("returns template unchanged if queryText is null", () => {
    const result = hydrate("q=#$query##", null)
    expect(result).toBe("q=#$query##")
  })

  it("returns template unchanged if queryText is undefined", () => {
    const result = hydrate("q=#$query##", undefined)
    expect(result).toBe("q=#$query##")
  })

  it("supports encodeURI config", () => {
    const result = hydrate("q=#$query##", "star wars", { encodeURI: true })
    expect(result).toBe("q=star%20wars")
  })

  it("replaces qOption placeholders", () => {
    const result = hydrate("field=#$qOption.myField##", "test", { qOption: { myField: "title" } })
    expect(result).toBe("field=title")
  })

  it("handles nested qOption with default value", () => {
    const result = hydrate("f=#$qOption.missing|fallback##", "test", { qOption: {} })
    expect(result).toBe("f=fallback")
  })

  it("hydrates objects recursively", () => {
    const template = { query: { match: { title: "#$query##" } } }
    const result = hydrate(template, "hello")
    expect(result).toEqual({ query: { match: { title: "hello" } } })
  })

  it("hydrates arrays", () => {
    const template = ["#$query##", "#$keyword1##"]
    const result = hydrate(template, "hello world")
    expect(result).toEqual(["hello world", "hello"])
  })

  it("supports keyword array access", () => {
    const template = { terms: "#$keyword##" }
    const result = hydrate(template, "star wars")
    // keyword is an array, full replacement returns the array itself
    expect(result.terms).toEqual(["star", "wars"])
  })
})
