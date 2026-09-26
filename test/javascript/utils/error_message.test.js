import { describe, expect, it } from "vitest"
import { errorMessage } from "utils/error_message"

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

  it("falls back to an Angular $http-style statusText", () => {
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
