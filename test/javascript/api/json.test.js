import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getJson, postJson, readJson } from "api/json"
import { HttpError } from "api/http_error"

describe("api/json", () => {
  beforeEach(() => {
    document.head.innerHTML = '<meta name="csrf-token" content="tok">'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubFetch(response) {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(response)))
  }

  it("postJson sends a JSON body with CSRF and returns the parsed response", async () => {
    stubFetch(new Response(JSON.stringify({ saved: true }), { status: 200 }))

    await expect(postJson("/x", { a: 1 })).resolves.toEqual({ saved: true })

    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe("/x")
    expect(init.method).toBe("POST")
    expect(init.body).toBe('{"a":1}')
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-CSRF-Token": "tok"
    })
  })

  it("keeps caller headers given as a Headers instance or tuple array, and lets them override defaults", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("{}", { status: 200 }))))

    await getJson("/x", { headers: new Headers({ "X-Trace": "1", accept: "text/plain" }) })
    await postJson("/x", {}, { headers: [["X-Trace", "2"]] })

    // Header-name casing is normalized differently by browsers and happy-dom.
    const sent = (call) =>
      Object.fromEntries(Object.entries(fetch.mock.calls[call][1].headers).map(([k, v]) => [k.toLowerCase(), v]))
    expect(sent(0)).toMatchObject({ "x-trace": "1", accept: "text/plain" })
    // The caller's header replaces the default rather than being sent alongside it.
    const acceptKeys = Object.keys(fetch.mock.calls[0][1].headers).filter((k) => k.toLowerCase() === "accept")
    expect(acceptKeys).toHaveLength(1)
    expect(fetch.mock.calls[0][1].method).toBe("GET")
    expect(sent(1)).toMatchObject({
      "x-trace": "2",
      "content-type": "application/json",
      accept: "application/json"
    })
  })

  it("getJson returns null for a 204", async () => {
    stubFetch(new Response(null, { status: 204 }))
    await expect(getJson("/x")).resolves.toBeNull()
  })

  it("throws an HttpError carrying status and body, using the server's message", async () => {
    stubFetch(new Response(JSON.stringify({ error: "nope" }), { status: 422 }))

    const error = await postJson("/x", {}).catch((e) => e)

    expect(error).toBeInstanceOf(HttpError)
    expect(error).toBeInstanceOf(Error)
    expect(error).toMatchObject({ status: 422, ok: false, data: { error: "nope" }, message: "nope" })
  })

  it("falls back to a status message when the error body is not JSON", async () => {
    stubFetch(new Response("<html>boom</html>", { status: 500 }))

    const error = await getJson("/x").catch((e) => e)

    expect(error).toBeInstanceOf(HttpError)
    expect(error.data).toBeNull()
    expect(error.message).toBe("Request failed (500)")
  })

  it("falls back to a status message when the error body's error is not a string", async () => {
    stubFetch(new Response(JSON.stringify({ error: { name: ["can't be blank"] } }), { status: 422 }))

    const error = await postJson("/x", {}).catch((e) => e)

    expect(error.message).toBe("Request failed (422)")
    expect(error.data).toEqual({ error: { name: ["can't be blank"] } })
  })

  it("rejects a malformed success body instead of returning null", async () => {
    await expect(readJson(new Response("not json", { status: 200 }))).rejects.toThrow(SyntaxError)
  })
})
