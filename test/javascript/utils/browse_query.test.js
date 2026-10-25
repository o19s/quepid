import { describe, expect, it } from "vitest"
import { buildBrowseCurlCommand, engineDisplayName } from "utils/browse_query"

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

  it("matches the legacy engine labels", () => {
    expect(engineDisplayName({ searchEngine: "solr" })).toBe("Solr")
    expect(engineDisplayName({ searchEngine: "searchapi", mapperBasedSearchEngineName: "Vespa" })).toBe("Vespa")
    expect(engineDisplayName({ searchEngine: "searchapi" })).toBe("Search API")
  })
})
