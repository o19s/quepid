import { describe, expect, it, vi } from "vitest"
import { buildBrowseCurlCommand, engineDisplayName, parseBrowseHeaders } from "utils/browse_query"

describe("browse query utilities", () => {
  it("encodes spaces in browse URL query parameters for curl", () => {
    const command = buildBrowseCurlCommand({
      url: "http://solr.example.test/select?q=work&fl=id catch_line structure text"
    })

    expect(command).toContain("'http://solr.example.test/select?q=work&fl=id+catch_line+structure+text'")
    expect(command).toContain("\\\n -X GET")
    expect(command).not.toContain("+ -X GET")
  })

  it("formats configured headers as curl options without literal plus signs", () => {
    const command = buildBrowseCurlCommand({
      url: "https://example.test/select",
      headers: { Authorization: "Basic abc123" }
    })

    expect(command).toContain("\\\n -H 'Authorization: Basic abc123'")
    expect(command).not.toContain("+ -H")
  })

  it("adds basic auth to configured custom headers", () => {
    vi.stubGlobal("window", { btoa: (value) => Buffer.from(value).toString("base64") })

    expect(parseBrowseHeaders('{"X-Test":"yes"}', "user:secret")).toEqual({
      "X-Test": "yes",
      Authorization: "Basic dXNlcjpzZWNyZXQ="
    })
  })

  it("matches the Angular engine labels", () => {
    expect(engineDisplayName({ searchEngine: "solr" })).toBe("Solr")
    expect(engineDisplayName({ searchEngine: "searchapi", mapperBasedSearchEngineName: "Vespa" })).toBe("Vespa")
    expect(engineDisplayName({ searchEngine: "searchapi" })).toBe("Search API")
  })
})
