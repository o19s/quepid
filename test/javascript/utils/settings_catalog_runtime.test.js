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

describe("settings catalog defaults", () => {
  const common = { escapeQuery: true, numberOfRows: 10 }
  const expected = {
    solr: {
      ...common, searchEngine: "solr", apiMethod: "JSONP", headerType: "None", customHeaders: "",
      fieldSpec: "id:id", idField: "id", titleField: "", additionalFields: [], proxyRequests: false,
      basicAuthCredential: "", supportsBasicAuth: true,
      insecureSearchUrl: "http://quepid-solr.dev.o19s.com:8985/solr/tmdb/select",
      secureSearchUrl: "https://quepid-solr.dev.o19s.com:8985/solr/tmdb/select",
      urlFormat: "http(s?)://yourdomain.com:8983/<index>/select"
    },
    es: {
      ...common, searchEngine: "es", apiMethod: "POST", headerType: "None", customHeaders: "",
      fieldSpec: "id:_id", idField: "_id", titleField: "", additionalFields: [], proxyRequests: false,
      basicAuthCredential: "", supportsBasicAuth: true,
      searchUrl: "http://quepid-elasticsearch.dev.o19s.com:9206/tmdb/_search",
      urlFormat: "http(s?)://yourdomain.com:9200/<index>/_search"
    },
    os: {
      ...common, searchEngine: "os", apiMethod: "POST", headerType: "None", customHeaders: "",
      fieldSpec: "id:_id", idField: "_id", titleField: "", additionalFields: [], proxyRequests: false,
      basicAuthCredential: "reader:reader", supportsBasicAuth: true,
      searchUrl: "https://quepid-opensearch.dev.o19s.com:9000/tmdb/_search",
      urlFormat: "http(s?)://yourdomain.com:9200/<index>/_search"
    },
    vectara: {
      ...common, searchEngine: "vectara", apiMethod: "POST", headerType: "Custom",
      fieldSpec: "id:id", idField: "id", titleField: "title", additionalFields: [], proxyRequests: false,
      basicAuthCredential: "", supportsBasicAuth: false,
      searchUrl: "https://api.vectara.io/v1/query", urlFormat: "https://api.vectara.io/v1/query"
    },
    algolia: {
      ...common, searchEngine: "algolia", apiMethod: "POST", headerType: "Custom",
      idField: "objectID", titleField: "title", additionalFields: ["overview", "cast", "thumb:poster_path"],
      proxyRequests: true, basicAuthCredential: "", supportsBasicAuth: false,
      searchUrl: "https://OKF83BFQS4-dsn.algolia.net/1/indexes/movies_demo_quepid/query",
      urlFormat: "https://<APPLICATION-ID>-dsn.algolia.net/1/indexes/<index>/query"
    },
    static: {
      ...common, searchEngine: "static", apiMethod: "GET", headerType: "None", customHeaders: "",
      fieldSpec: "id:id", idField: "id", titleField: "", additionalFields: [], proxyRequests: false,
      supportsBasicAuth: false, queryParams: "q=#$query##"
    },
    searchapi: {
      ...common, searchEngine: "searchapi", apiMethod: "POST", headerType: "None", customHeaders: "",
      fieldSpec: null, idField: null, titleField: null, additionalFields: [], proxyRequests: true,
      supportsBasicAuth: true, urlFormat: null, searchUrl: "https://example.com/api/search"
    }
  }

  it.each(Object.keys(expected))("keeps the %s preset's contract fields", (engine) => {
    const defaults = createSettingsCatalog().defaultSettings()[engine]
    expect(defaults).toMatchObject(expected[engine])
    if (engine !== "searchapi") expect(defaults.queryParams).toContain("#$query##")
  })

  it("ships mapper code and JSON headers that parse for the engines that need them", () => {
    const defaults = createSettingsCatalog().defaultSettings()
    expect(defaults.searchapi.mapperCode).toContain("docsMapper")
    expect(defaults.searchapi.mapperCode).toContain("numberOfResultsMapper")
    for (const engine of ["vectara", "algolia"]) expect(() => JSON.parse(defaults[engine].customHeaders)).not.toThrow()
    for (const engine of ["es", "os", "vectara", "algolia"]) expect(() => JSON.parse(defaults[engine].queryParams)).not.toThrow()
    expect(defaults.solr.queryParams).toBe("q=#$query##\n&tie=1.0")
  })

  it("returns an isolated copy of defaults per catalog", () => {
    const first = createSettingsCatalog()
    first.defaultSettings().solr.apiMethod = "POST"
    expect(createSettingsCatalog().defaultSettings().solr.apiMethod).toBe("JSONP")
  })

  it("provides TMDB demo presets for solr, es and os", () => {
    const catalog = createSettingsCatalog()
    const extra = ["overview", "cast", "thumb:poster_path"]
    expect(catalog.pickSettingsToUse("solr")).toMatchObject({
      fieldSpec: "id:id, title:title", idField: "id", titleField: "title", additionalFields: extra,
      searchEngine: "solr"
    })
    expect(catalog.pickSettingsToUse("solr").queryParams).toContain("defType=edismax")
    for (const engine of ["es", "os"]) {
      const settings = catalog.pickSettingsToUse(engine, catalog.defaultSettings()[engine].searchUrl)
      expect(settings).toMatchObject({
        fieldSpec: "id:_id, title:title", titleField: "title", additionalFields: extra, searchEngine: engine
      })
      expect(settings.queryParams).toContain("title^10")
    }
  })

  it("only treats solr demo URLs as demo settings, and others only by exact URL", () => {
    const catalog = createSettingsCatalog()
    const { insecureSearchUrl, secureSearchUrl } = catalog.defaultSettings().solr
    expect(catalog.demoSettingsChosen("solr", insecureSearchUrl)).toBe(true)
    expect(catalog.demoSettingsChosen("solr", secureSearchUrl)).toBe(true)
    expect(catalog.demoSettingsChosen("solr", "")).toBe(false)
    expect(catalog.demoSettingsChosen("es", undefined)).toBe(false)
    expect(catalog.demoSettingsChosen("os", "https://quepid-opensearch.dev.o19s.com:9000/tmdb/_search")).toBe(true)
    expect(catalog.demoSettingsChosen("os", "https://elsewhere")).toBe(false)
  })

  it("links the troubleshooting wiki page for each engine", () => {
    const catalog = createSettingsCatalog()
    const pages = {
      solr: "Solr", es: "Elasticsearch", os: "OpenSearch", vectara: "Vectara", searchapi: "SearchAPI"
    }
    for (const [engine, name] of Object.entries(pages)) {
      expect(catalog.troubleshootingWikiUrl(engine)).toBe(
        `https://github.com/o19s/quepid/wiki/Troubleshooting-${name}-and-Quepid`
      )
    }
    expect(catalog.troubleshootingWikiUrl("searchapi", "vespa")).toContain("Vespa")
  })

  it("limits escapeQuery support to solr, es and os", () => {
    const catalog = createSettingsCatalog()
    for (const engine of ["solr", "es", "os"]) expect(catalog.supportsEscapeQuery(engine)).toBe(true)
    for (const engine of ["vectara", "algolia", "static", "searchapi", ""]) {
      expect(catalog.supportsEscapeQuery(engine)).toBe(false)
    }
  })
})

