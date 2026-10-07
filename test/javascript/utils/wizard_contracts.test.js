import { describe, expect, it } from "vitest"
import {
  addUniqueQuery,
  buildFieldSpec,
  formatValidationError,
  formatWizardSaveError,
  invalidProxyApiMethod,
  parseCustomHeaders,
  searchApiValidationArgs,
  validateStaticHeaders
} from "utils/wizard_contracts"

describe("wizard contracts", () => {
  it("accepts JSON object headers and rejects malformed or non-object values", () => {
    expect(parseCustomHeaders('{"Authorization":"Bearer token"}').valid).toBe(true)
    expect(parseCustomHeaders({ Authorization: "Bearer token" }).valid).toBe(true)
    expect(parseCustomHeaders("not json").valid).toBe(false)
    expect(parseCustomHeaders("[]").valid).toBe(false)
  })

  it("rejects JSONP when proxying", () => {
    expect(invalidProxyApiMethod(true, "JSONP")).toBe(true)
    expect(invalidProxyApiMethod(false, "JSONP")).toBe(false)
  })

  it("validates the required static snapshot headers and field names", () => {
    expect(validateStaticHeaders("Query Text,Doc ID,Doc Position,title").valid).toBe(true)
    expect(validateStaticHeaders("Query Text,Doc ID").valid).toBe(false)
    expect(validateStaticHeaders("Query Text,Doc ID,Doc Position,field name").valid).toBe(false)
  })

  it("builds the legacy field-spec shape", () => {
    expect(buildFieldSpec("id", "title", [{ text: "brand" }])).toBe("id:id, title:title, brand")
  })

  it("adds non-empty queries once", () => {
    const queries = addUniqueQuery([], "star wars")
    expect(addUniqueQuery(queries, "star wars")).toEqual(queries)
    expect(addUniqueQuery(queries, "")).toEqual(queries)
  })

  it("formats API validation errors for the finish step", () => {
    expect(formatWizardSaveError({ data: { case_name: ["is invalid"] } })).toContain("case_name is invalid")
    expect(formatWizardSaveError({})).toBe("Could not save your case settings. Please click Finish to try again.")
  })

  it("turns any validator rejection into readable text instead of [object Object]", () => {
    expect(formatValidationError(new Error("boom"))).toBe("boom")
    expect(formatValidationError("plain")).toBe("plain")
    expect(formatValidationError({ searchError: "Error with Solr query or server." })).toBe("Error with Solr query or server.")
    expect(formatValidationError({ status: -1, statusText: "Not Found" })).toBe("Not Found")
    expect(formatValidationError({ status: 0 })).toBe("Quepid could not search this endpoint.")
    expect(formatValidationError(undefined)).toBe("Quepid could not search this endpoint.")
  })
})

 it("keeps Search API JSON and generic parameter lists unchanged, and parses Vespa scalar/repeated parameters", () => {
  expect(searchApiValidationArgs('{"yql":"select * from movies"}', "yql")).toBe('{"yql":"select * from movies"}')
  expect(searchApiValidationArgs("q=test", null)).toBe("q=test")
  expect(searchApiValidationArgs("select * from movies", "yql")).toEqual({ yql: "select * from movies" })
  expect(searchApiValidationArgs('yql=select * where title="test"\n&ranking.profile=bm25&filter=one&filter=two', "yql")).toEqual({
    yql: 'select * where title="test"',
    "ranking.profile": "bm25",
    filter: ["one", "two"]
  })})

describe("edge cases", () => {
  const plain = (value) => ({ ...value })

  it("treats text as a bare query unless it starts with a key= param", () => {
    expect(searchApiValidationArgs("hello a=1", "q")).toEqual({ q: "hello a=1" })
    expect(plain(searchApiValidationArgs("  a=1&b=2", "q"))).toEqual({ a: "1", b: "2" })
    expect(searchApiValidationArgs("{\"a\":1}", "q")).toBe("{\"a\":1}")
    expect(searchApiValidationArgs("a=1", undefined)).toBe("a=1")
  })

  it("joins trimmed lines, keeps valueless and empty-key params, and collects repeats", () => {
    expect(plain(searchApiValidationArgs("a=1&\n  b=2", "q"))).toEqual({ a: "1", b: "2" })
    expect(plain(searchApiValidationArgs("a=1\r\n&flag", "q"))).toEqual({ a: "1", flag: null })
    expect(plain(searchApiValidationArgs("a=1&=x", "q"))).toEqual({ a: "1", "": "x" })
    expect(plain(searchApiValidationArgs("a=1&a=2&a=3", "q"))).toEqual({ a: ["1", "2", "3"] })
  })

  it("treats blank header text as no headers rather than invalid JSON", () => {
    expect(parseCustomHeaders("   ")).toEqual({ valid: true, headers: null })
    expect(parseCustomHeaders("\n")).toEqual({ valid: true, headers: null })
  })

  it("flags any document header with inner whitespace but ignores padding", () => {
    const required = "Query Text,Doc ID,Doc Position"
    expect(validateStaticHeaders(`${required},title `).valid).toBe(true)
    expect(validateStaticHeaders(`${required},ok,bad field`).valid).toBe(false)
    expect(validateStaticHeaders(`${required},bad field,ok`).errors[0]).toContain("bad field,ok")
  })

  it("builds field specs from plain strings or tag objects, skipping blanks", () => {
    expect(buildFieldSpec("i", "t", [{ text: "a" }, "b", "", { text: "" }])).toBe("id:i, title:t, a, b")
    expect(buildFieldSpec("i", "t")).toBe("id:i, title:t")
  })

  it("ignores null, undefined and empty query text", () => {
    const queries = [{ queryString: "a" }]
    for (const blank of [null, undefined, ""]) expect(addUniqueQuery(queries, blank)).toBe(queries)
    expect(addUniqueQuery(queries, "a")).toBe(queries)
    expect(addUniqueQuery(queries, "b")).toEqual([{ queryString: "a" }, { queryString: "b" }])
  })

  it("formats object save errors and falls back for null data", () => {
    expect(formatWizardSaveError({ data: null })).toBe(
      "Could not save your case settings. Please click Finish to try again."
    )
    expect(formatWizardSaveError({ data: { name: ["is bad", "x"], foo: "bar", n: 3 } })).toBe(
      "Could not save your case settings: name is bad, x. bar. Please click Finish to try again."
    )
    expect(formatWizardSaveError({ data: { error: "nope" } })).toContain(": nope.")
  })

  it("strips only a leading Error: prefix and falls through non-string details", () => {
    expect(formatValidationError(new Error("Error:   boom"))).toBe("boom")
    expect(formatValidationError(new Error("Error: boom"))).toBe("boom")
    expect(formatValidationError(new Error("Fatal Error: boom"))).toBe("Fatal Error: boom")
    expect(formatValidationError({ searchError: "", data: "from data" })).toBe("from data")
    expect(formatValidationError({ message: 5 })).toBe("Quepid could not search this endpoint.")
  })
})
