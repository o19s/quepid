import { describe, it, expect } from "vitest"
import { createFieldSpec as parseFieldSpec } from "splainer-search"

describe("createFieldSpec (from splainer-search)", () => {
  it("parses a simple title field", () => {
    const spec = parseFieldSpec("title")
    expect(spec.title).toBe("title")
    expect(spec.fields).toContain("title")
  })

  it("parses title and sub fields", () => {
    const spec = parseFieldSpec("title overview")
    expect(spec.title).toBe("title")
    expect(spec.subs).toContain("overview")
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

  it('defaults id to "id"', () => {
    const spec = parseFieldSpec("id title")
    expect(spec.id).toBe("id")
  })

  it("returns default spec for null input", () => {
    // splainer-search defaults null to 'id:id title:id *' (wildcard subs)
    const spec = parseFieldSpec(null)
    expect(spec.id).toBe("id")
    expect(spec.title).toBe("id")
    expect(spec.subs).toBe("*")
  })

  it("handles comma-separated specs", () => {
    const spec = parseFieldSpec("title,overview,id")
    expect(spec.title).toBe("title")
    expect(spec.subs).toContain("overview")
  })

  it("parses media:field for embed fields", () => {
    const spec = parseFieldSpec("title media:audio_url media:image_url")
    // splainer-search stores media fields as .embeds (not .media)
    expect(spec.embeds).toEqual(["audio_url", "image_url"])
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
    expect(spec.subs).toContain("author")
    expect(spec.thumb).toBe("cover")
    expect(spec.embeds).toEqual(["preview"])
    expect(spec.translations).toEqual(["summary_de"])
  })

  it("provides fieldList() method", () => {
    const spec = parseFieldSpec("id:_id title:name description")
    const fl = spec.fieldList()
    expect(Array.isArray(fl)).toBe(true)
    expect(fl).toContain("_id")
    expect(fl).toContain("name")
    expect(fl).toContain("description")
  })

  it("fieldList() returns * for wildcard subs", () => {
    const spec = parseFieldSpec("")
    expect(spec.fieldList()).toContain("*")
  })
})
