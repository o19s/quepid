import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { jsonFetch, railsJsonHeaders } from "../../../app/javascript/modules/json_fetch"

describe("railsJsonHeaders", () => {
  beforeEach(() => {
    document.head.innerHTML = ""
  })

  it("includes Accept and omits CSRF when meta tag is absent", () => {
    expect(railsJsonHeaders({ contentTypeJson: true })).toEqual({
      Accept: "application/json",
      "Content-Type": "application/json",
    })
  })

  it("includes X-CSRF-Token when meta tag exists", () => {
    document.head.innerHTML = '<meta name="csrf-token" content="tok">'
    expect(railsJsonHeaders({ contentTypeJson: true })).toEqual({
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-CSRF-Token": "tok",
    })
  })

  it("can disable accept, content-type, or csrf independently", () => {
    document.head.innerHTML = '<meta name="csrf-token" content="tok">'
    expect(
      railsJsonHeaders({
        acceptJson: false,
        contentTypeJson: false,
        csrf: false,
      }),
    ).toEqual({})
  })
})

describe("jsonFetch", () => {
  beforeEach(() => {
    document.head.innerHTML = '<meta name="csrf-token" content="csrf">'
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(null, {
            status: 204,
          }),
        ),
      ),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("merges default JSON headers and forwards method, body, signal", async () => {
    const fetchMock = globalThis.fetch
    const ac = new AbortController()

    await jsonFetch("api/foo", {
      method: "POST",
      body: JSON.stringify({ a: 1 }),
      signal: ac.signal,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "api/foo",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ a: 1 }),
        signal: ac.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRF-Token": "csrf",
        },
      }),
    )
  })

  it("does not set Content-Type when body is omitted", async () => {
    const fetchMock = globalThis.fetch

    await jsonFetch("api/foo", { method: "GET" })

    expect(fetchMock).toHaveBeenCalledWith(
      "api/foo",
      expect.objectContaining({
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-CSRF-Token": "csrf",
        },
      }),
    )
  })

  it("lets caller headers override defaults", async () => {
    const fetchMock = globalThis.fetch

    await jsonFetch("api/foo", {
      method: "GET",
      headers: { Accept: "text/plain" },
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "api/foo",
      expect.objectContaining({
        method: "GET",
        headers: {
          Accept: "text/plain",
          "X-CSRF-Token": "csrf",
        },
      }),
    )
  })
})
