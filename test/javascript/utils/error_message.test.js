import { HttpError } from "api/http_error"
import { describe, expect, it } from "vitest"
import { errorMessage, flashErrorMessage, serverMessage } from "utils/error_message"
import { SearchError } from "utils/search_error"

describe("errorMessage", () => {
  it("returns a plain string error as-is", () => {
    expect(errorMessage("Solr timed out", "fallback")).toBe("Solr timed out")
  })

  it("prefers a JS Error's message", () => {
    expect(errorMessage(new Error("boom"), "fallback")).toBe("boom")
  })

  it("falls back to an app-specific error field", () => {
    expect(errorMessage({ error: "Unable to add query." }, "fallback")).toBe("Unable to add query.")
  })

  it("falls back to a $http-style statusText", () => {
    expect(errorMessage({ statusText: "Not Found" }, "fallback")).toBe("Not Found")
  })

  it("prefers message over an app-specific error field when both are present", () => {
    expect(errorMessage({ message: "m", error: "e" }, "fallback")).toBe("m")
  })

  it("prefers an app-specific error field over statusText when both are present", () => {
    expect(errorMessage({ error: "e", statusText: "s" }, "fallback")).toBe("e")
  })

  it("uses the fallback for an empty string, null, or an object with no usable field", () => {
    expect(errorMessage("", "fallback")).toBe("fallback")
    expect(errorMessage(null, "fallback")).toBe("fallback")
    expect(errorMessage({}, "fallback")).toBe("fallback")
  })
})

describe("flashErrorMessage", () => {
  it("keeps a structured search error so the flash can render its links", () => {
    const error = new SearchError([{ text: "see " }, { text: "wiki", href: "https://example.com" }])

    expect(flashErrorMessage(error, "fallback")).toBe(error)
  })

  it("falls back to errorMessage for other errors", () => {
    expect(flashErrorMessage(new Error("boom"), "fallback")).toBe("boom")
    expect(flashErrorMessage(null, "fallback")).toBe("fallback")
  })
})

describe("serverMessage", () => {
  it("uses server errors and messages before the contextual fallback", () => {
    expect(serverMessage(new HttpError({ status: 422, data: { error: "Invalid", message: "Other" } }), "fallback")).toBe("Invalid")
    expect(serverMessage(new HttpError({ status: 422, data: { message: "Invalid" } }), "fallback")).toBe("Invalid")
  })

  it("keeps a contextual fallback for HTTP responses without a usable message", () => {
    for (const data of [null, {}, { error: ["Invalid"] }]) {
      expect(serverMessage(new HttpError({ status: 500, data }), "Try again")).toBe("Try again")
    }
  })

  it("preserves ordinary errors and tolerates missing errors", () => {
    expect(serverMessage(new Error("offline"), "fallback")).toBe("offline")
    expect(serverMessage(null, "fallback")).toBe("fallback")
  })
})
