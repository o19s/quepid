import { describe, expect, it } from "vitest"
import { createSettingsCatalog } from "utils/settings_catalog_runtime"

describe("settings catalog runtime", () => {
  it("provides the built-in presets without a framework", () => {
    const catalog = createSettingsCatalog()

    expect(catalog.defaultSettings()).toMatchObject({
      solr: { searchEngine: "solr", apiMethod: "JSONP" },
      es: { searchEngine: "es", apiMethod: "POST" },
      static: { searchEngine: "static", queryParams: "q=#$query##" },
      searchapi: { searchEngine: "searchapi", supportsBasicAuth: true }
    })
    expect(catalog.defaultSolrQueryParams()).toContain("q=#$query##")
  })

  it("registers mapper engines and falls back to custom search API settings", () => {
    const catalog = createSettingsCatalog()
    const engine = { id: 12, searchEngine: "searchapi", name: "Vespa" }

    catalog.registerMapper(engine)

    expect(catalog.defaultSettings()[12]).toBe(engine)
    expect(catalog.pickSettingsToUse(12)).toEqual(engine)
    expect(catalog.pickSettingsToUse("missing").searchEngine).toBe("searchapi")
  })

  it("selects TMDB demo settings only for matching URLs", () => {
    const catalog = createSettingsCatalog()

    expect(catalog.demoSettingsChosen("solr")).toBe(true)
    expect(catalog.demoSettingsChosen("solr", "https://other.example.test")).toBe(false)
    expect(catalog.demoSettingsChosen("es", "http://quepid-elasticsearch.dev.o19s.com:9206/tmdb/_search")).toBe(true)
    expect(catalog.demoSettingsChosen("algolia", null)).toBe(false)
    expect(catalog.pickSettingsToUse("solr").fieldSpec).toBe("id:id, title:title")
  })

  it("preserves engine policy and troubleshooting URLs", () => {
    const catalog = createSettingsCatalog()

    expect(catalog.supportsLookupById("solr")).toBe(true)
    expect(catalog.supportsLookupById("vectara")).toBe(false)
    expect(catalog.supportsEscapeQuery("os")).toBe(true)
    expect(catalog.supportsEscapeQuery("algolia")).toBe(false)
    expect(catalog.troubleshootingWikiUrl("solr")).toContain("Troubleshooting-Solr-and-Quepid")
    expect(catalog.troubleshootingWikiUrl("searchapi", "vespa")).toContain("Troubleshooting-Vespa-and-Quepid")
    expect(catalog.troubleshootingWikiUrl("unknown")).toBe(null)
  })

  it("resets mapper registrations", () => {
    const catalog = createSettingsCatalog()
    catalog.registerMapper({ id: 12, searchEngine: "searchapi" })

    catalog.reset()

    expect(catalog.defaultSettings()[12]).toBeUndefined()
  })
})
