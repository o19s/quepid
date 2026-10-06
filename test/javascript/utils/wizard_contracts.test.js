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
  })
})
