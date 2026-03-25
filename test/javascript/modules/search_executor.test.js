import { describe, it, expect, vi, afterEach } from "vitest"
import { executeSearch, parseFieldSpec } from "../../../app/javascript/modules/search_executor"

describe("parseFieldSpec", () => {
  it("parses a simple title field", () => {
    const spec = parseFieldSpec("title")
    expect(spec.title).toBe("title")
    expect(spec.fields).toEqual(["title"])
  })

  it("parses title and sub fields", () => {
    const spec = parseFieldSpec("title overview")
    expect(spec.title).toBe("title")
    expect(spec.subs).toEqual(["overview"])
  })

  it("parses typed fields like id:_id", () => {
    const spec = parseFieldSpec("id:_id title:name")
    expect(spec.id).toBe("_id")
    expect(spec.title).toBe("name")
  })

  it("parses complex field spec with thumb", () => {
    const spec = parseFieldSpec("id:doc_id title overview thumb:poster_url")
    expect(spec.id).toBe("doc_id")
    expect(spec.title).toBe("title")
    expect(spec.subs).toContain("overview")
    expect(spec.thumb).toBe("poster_url")
  })

  it('defaults id to "id" when present in fields', () => {
    const spec = parseFieldSpec("id title")
    expect(spec.id).toBe("id")
  })

  it("returns empty result for null input", () => {
    const spec = parseFieldSpec(null)
    expect(spec.title).toBeNull()
    expect(spec.fields).toEqual([])
  })

  it("handles comma-separated specs", () => {
    const spec = parseFieldSpec("title,overview,id")
    expect(spec.title).toBe("title")
    expect(spec.subs).toContain("overview")
    expect(spec.id).toBe("id")
  })

  it("parses media:field for embed fields", () => {
    const spec = parseFieldSpec("title media:audio_url media:image_url")
    expect(spec.media).toEqual(["audio_url", "image_url"])
    expect(spec.fields).toContain("audio_url")
    expect(spec.fields).toContain("image_url")
  })

  it("parses translate:field for translation fields", () => {
    const spec = parseFieldSpec("title translate:description_fr")
    expect(spec.translations).toEqual(["description_fr"])
    expect(spec.fields).toContain("description_fr")
  })

  it("parses mixed spec with media, translate, thumb, and sub", () => {
    const spec = parseFieldSpec(
      "id:doc_id title sub:author thumb:cover media:preview translate:summary_de",
    )
    expect(spec.id).toBe("doc_id")
    expect(spec.title).toBe("title")
    expect(spec.subs).toEqual(["author"])
    expect(spec.thumb).toBe("cover")
    expect(spec.media).toEqual(["preview"])
    expect(spec.translations).toEqual(["summary_de"])
  })
})

describe("executeSearch", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns an error for unsupported engines without calling fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const result = await executeSearch(
      { search_engine: "unknown", search_url: "http://example.test/" },
      "q",
      new AbortController().signal,
    )
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(result.error).toMatch(/not yet supported/)
    expect(result.docs).toEqual([])
    expect(result.numFound).toBe(0)
  })

  it("runs Solr through proxy/fetch and passes the abort signal", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ response: { docs: [{ id: "a", title: "T1" }], numFound: 7 } }),
    })
    const ac = new AbortController()
    const tryConfig = {
      search_engine: "solr",
      search_url: "http://solr.test/select",
      args: { q: ["#$query##"], rows: [10] },
      field_spec: "title id",
      proxy_requests: true,
    }

    const result = await executeSearch(tryConfig, "coffee", ac.signal)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(String(url)).toContain("proxy/fetch")
    expect(String(url)).toContain(encodeURIComponent("http://solr.test/select"))
    expect(init.signal).toBe(ac.signal)
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" })
    expect(result.numFound).toBe(7)
    expect(result.docs[0].title).toBe("T1")
    expect(result.renderedTemplate).toContain(encodeURIComponent("coffee"))
    expect(result.renderedTemplate).toMatch(/^http:\/\/solr\.test\/select\?/)
  })

  it("POSTs JSON for ES via proxy and passes the abort signal", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          hits: { hits: [{ _id: "1", _source: { title: "ES Title" } }], total: 2 },
        }),
    })
    const ac = new AbortController()
    const tryConfig = {
      search_engine: "es",
      search_url: "http://es.test/_search",
      args: { query: { match: { title: "#$query##" } }, pager: { from: 0, size: 5 } },
      field_spec: "title id",
      proxy_requests: true,
    }

    const result = await executeSearch(tryConfig, "needle", ac.signal)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [, init] = fetchSpy.mock.calls[0]
    expect(init.method).toBe("POST")
    expect(init.signal).toBe(ac.signal)
    expect(JSON.parse(init.body).query.match.title).toBe("needle")
    expect(result.numFound).toBe(2)
    expect(result.docs[0].title).toBe("ES Title")
    const templateObj = JSON.parse(result.renderedTemplate)
    expect(templateObj.query.match.title).toBe("needle")
  })
})
