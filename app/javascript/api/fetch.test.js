import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { apiFetch, getCsrfToken } from "api/fetch"

describe("getCsrfToken", () => {
  beforeEach(() => {
    document.head.innerHTML = ""
  })

  it("reads the csrf-token meta tag", () => {
    document.head.innerHTML = '<meta name="csrf-token" content="abc123">'
    expect(getCsrfToken()).toBe("abc123")
  })

  it("returns empty string when meta is missing", () => {
    expect(getCsrfToken()).toBe("")
  })
})

describe("apiFetch", () => {
  beforeEach(() => {
    document.head.innerHTML = '<meta name="csrf-token" content="page-token">'
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("ok")))
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("merges CSRF token into header objects", async () => {
    await apiFetch("/api/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    })

    expect(fetch).toHaveBeenCalledOnce()
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe("/api/cases")
    expect(init.method).toBe("POST")
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      "X-CSRF-Token": "page-token"
    })
  })

  it("merges CSRF token into header tuple arrays", async () => {
    await apiFetch("/api/cases", {
      method: "POST",
      headers: [["Content-Type", "application/json"]]
    })

    const init = fetch.mock.calls[0][1]
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      "X-CSRF-Token": "page-token"
    })
  })

  it("merges CSRF token into Headers instances", async () => {
    await apiFetch("/api/cases", {
      method: "POST",
      headers: new Headers({ "Content-Type": "application/json" })
    })

    const init = fetch.mock.calls[0][1]
    const contentTypeKey = Object.keys(init.headers).find(
      (key) => key.toLowerCase() === "content-type"
    )
    expect(contentTypeKey).toBeDefined()
    expect(init.headers[contentTypeKey]).toBe("application/json")
    expect(init.headers["X-CSRF-Token"]).toBe("page-token")
  })

  it("does not overwrite a non-empty CSRF header", async () => {
    await apiFetch("/api/cases", {
      headers: { "X-CSRF-Token": "already-set" }
    })

    const init = fetch.mock.calls[0][1]
    expect(init.headers["X-CSRF-Token"]).toBe("already-set")
  })

  it("does not overwrite CSRF token on Headers instances", async () => {
    await apiFetch("/api/cases", {
      headers: new Headers({ "X-CSRF-Token": "already-set" })
    })

    const init = fetch.mock.calls[0][1]
    const csrfKeys = Object.keys(init.headers).filter((key) => key.toLowerCase() === "x-csrf-token")
    expect(csrfKeys).toHaveLength(1)
    expect(init.headers[csrfKeys[0]]).toBe("already-set")
  })

  it("fills empty CSRF header value from meta", async () => {
    await apiFetch("/api/cases", {
      headers: { "X-CSRF-Token": "" }
    })

    const init = fetch.mock.calls[0][1]
    expect(init.headers["X-CSRF-Token"]).toBe("page-token")
  })

  it("preserves Request headers when init.headers is omitted", async () => {
    const request = new Request("/api/cases", {
      method: "POST",
      headers: {
        Authorization: "Bearer xyz",
        "Content-Type": "application/json"
      }
    })

    await apiFetch(request)

    expect(fetch).toHaveBeenCalledOnce()
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe(request)
    expect(init.headers).toMatchObject({
      Authorization: "Bearer xyz",
      "Content-Type": "application/json",
      "X-CSRF-Token": "page-token"
    })
  })
})
