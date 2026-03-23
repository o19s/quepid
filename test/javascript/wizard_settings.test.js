import { describe, it, expect } from "vitest"
import {
  defaultSettings,
  tmdbSettings,
  isDemoUrl,
  pickSettings,
} from "modules/wizard_settings"

describe("wizard_settings", () => {
  describe("defaultSettings", () => {
    it("has all seven engine types", () => {
      const engines = Object.keys(defaultSettings)
      expect(engines).toContain("solr")
      expect(engines).toContain("es")
      expect(engines).toContain("os")
      expect(engines).toContain("vectara")
      expect(engines).toContain("algolia")
      expect(engines).toContain("static")
      expect(engines).toContain("searchapi")
      expect(engines).toHaveLength(7)
    })

    it("Solr defaults to JSONP api method", () => {
      expect(defaultSettings.solr.apiMethod).toBe("JSONP")
    })

    it("ES defaults to POST api method", () => {
      expect(defaultSettings.es.apiMethod).toBe("POST")
    })

    it("Algolia has proxy enabled by default", () => {
      expect(defaultSettings.algolia.proxyRequests).toBe(true)
    })

    it("SearchAPI has mapper code", () => {
      expect(defaultSettings.searchapi.mapperCode).toContain("numberOfResultsMapper")
      expect(defaultSettings.searchapi.mapperCode).toContain("docsMapper")
    })
  })

  describe("tmdbSettings", () => {
    it("has Solr, ES, and OS demo endpoints", () => {
      expect(tmdbSettings.solr).toBeDefined()
      expect(tmdbSettings.es).toBeDefined()
      expect(tmdbSettings.os).toBeDefined()
    })

    it("Solr TMDB has edismax query params", () => {
      expect(tmdbSettings.solr.queryParams).toContain("edismax")
    })

    it("ES TMDB has title^10 boost", () => {
      expect(tmdbSettings.es.queryParams).toContain("title^10")
    })

    it("all TMDB settings have titleField set", () => {
      expect(tmdbSettings.solr.titleField).toBe("title")
      expect(tmdbSettings.es.titleField).toBe("title")
      expect(tmdbSettings.os.titleField).toBe("title")
    })
  })

  describe("isDemoUrl", () => {
    it("returns true for Solr insecure demo URL", () => {
      expect(
        isDemoUrl("solr", "http://quepid-solr.dev.o19s.com:8985/solr/tmdb/select"),
      ).toBe(true)
    })

    it("returns true for Solr secure demo URL", () => {
      expect(
        isDemoUrl("solr", "https://quepid-solr.dev.o19s.com/solr/tmdb/select"),
      ).toBe(true)
    })

    it("returns true for Solr with null URL (default)", () => {
      expect(isDemoUrl("solr", null)).toBe(true)
    })

    it("returns false for custom Solr URL", () => {
      expect(
        isDemoUrl("solr", "http://mysolr.example.com/solr/products/select"),
      ).toBe(false)
    })

    it("returns true for ES demo URL", () => {
      expect(
        isDemoUrl("es", "http://quepid-elasticsearch.dev.o19s.com:9206/tmdb/_search"),
      ).toBe(true)
    })

    it("returns false for engines without TMDB settings", () => {
      expect(isDemoUrl("vectara", "https://api.vectara.io/v1/query")).toBe(false)
      expect(isDemoUrl("algolia", "https://example.com")).toBe(false)
      expect(isDemoUrl("static", "")).toBe(false)
    })
  })

  describe("pickSettings", () => {
    it("returns TMDB settings for demo Solr URL", () => {
      const settings = pickSettings(
        "solr",
        "https://quepid-solr.dev.o19s.com/solr/tmdb/select",
      )
      expect(settings.queryParams).toContain("edismax")
      expect(settings.titleField).toBe("title")
    })

    it("returns generic defaults for custom Solr URL", () => {
      const settings = pickSettings(
        "solr",
        "http://mysolr.example.com/solr/products/select",
      )
      expect(settings.queryParams).not.toContain("edismax")
      expect(settings.titleField).toBe("")
    })

    it("returns deep clone (not reference)", () => {
      const s1 = pickSettings("solr", null)
      const s2 = pickSettings("solr", null)
      s1.titleField = "modified"
      expect(s2.titleField).toBe("title") // unaffected
    })

    it("returns empty object for unknown engine", () => {
      const settings = pickSettings("unknown", "http://example.com")
      expect(settings).toEqual({})
    })
  })
})
