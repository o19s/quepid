import { describe, it, expect, beforeEach } from "vitest"
import { apiUrl, csrfToken } from "../../../app/javascript/modules/api_url"

describe("apiUrl", () => {
  beforeEach(() => {
    document.body.dataset.quepidRootUrl = ""
  })

  it("returns a relative URL when rootUrl is empty", () => {
    expect(apiUrl("api/cases/1/queries")).toBe("api/cases/1/queries")
  })

  it("strips leading slash to avoid absolute paths when rootUrl is empty", () => {
    expect(apiUrl("/api/cases/1/queries")).toBe("api/cases/1/queries")
  })

  it("joins rootUrl and path with one slash", () => {
    document.body.dataset.quepidRootUrl = "https://example.com/quepid"
    expect(apiUrl("api/cases/1")).toBe("https://example.com/quepid/api/cases/1")
  })

  it("handles trailing slash on rootUrl", () => {
    document.body.dataset.quepidRootUrl = "https://example.com/quepid/"
    expect(apiUrl("api/cases/1")).toBe("https://example.com/quepid/api/cases/1")
  })

  it("handles leading slash on path with rootUrl", () => {
    document.body.dataset.quepidRootUrl = "https://example.com/quepid"
    expect(apiUrl("/api/cases/1")).toBe("https://example.com/quepid/api/cases/1")
  })
})

describe("csrfToken", () => {
  it("returns null when no meta tag exists", () => {
    document.head.innerHTML = ""
    expect(csrfToken()).toBeUndefined()
  })

  it("returns the token from the meta tag", () => {
    document.head.innerHTML = '<meta name="csrf-token" content="abc123">'
    expect(csrfToken()).toBe("abc123")
  })
})
