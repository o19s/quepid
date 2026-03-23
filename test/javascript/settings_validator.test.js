import { describe, it, expect } from "vitest"
import {
  validateHeaders,
  isInvalidProxyApiMethod,
  validateMapperCode,
} from "modules/settings_validator"

describe("settings_validator", () => {
  describe("validateHeaders", () => {
    it("returns true for empty string", () => {
      expect(validateHeaders("")).toBe(true)
    })

    it("returns true for null", () => {
      expect(validateHeaders(null)).toBe(true)
    })

    it("returns true for valid JSON", () => {
      expect(validateHeaders('{"x-api-key": "abc123"}')).toBe(true)
    })

    it("returns false for invalid JSON", () => {
      expect(validateHeaders("{bad json}")).toBe(false)
    })

    it("returns true for whitespace-only string", () => {
      expect(validateHeaders("   ")).toBe(true)
    })
  })

  describe("isInvalidProxyApiMethod", () => {
    it("returns true when proxy is on and method is JSONP", () => {
      expect(isInvalidProxyApiMethod(true, "JSONP")).toBe(true)
    })

    it("returns false when proxy is on and method is GET", () => {
      expect(isInvalidProxyApiMethod(true, "GET")).toBe(false)
    })

    it("returns false when proxy is off and method is JSONP", () => {
      expect(isInvalidProxyApiMethod(false, "JSONP")).toBe(false)
    })

    it("returns false when proxy is on and method is POST", () => {
      expect(isInvalidProxyApiMethod(true, "POST")).toBe(false)
    })
  })

  describe("validateMapperCode", () => {
    it("returns valid for correct mapper code", () => {
      const code = [
        "numberOfResultsMapper = function(data) { return data.length; };",
        "docsMapper = function(data) { return data; };",
      ].join("\n")
      const result = validateMapperCode(code)
      expect(result.valid).toBe(true)
      expect(result.error).toBeNull()
    })

    it("returns invalid for empty mapper code", () => {
      const result = validateMapperCode("")
      expect(result.valid).toBe(false)
      expect(result.error).toContain("required")
    })

    it("returns invalid for missing numberOfResultsMapper", () => {
      const code = "docsMapper = function(data) { return data; };"
      const result = validateMapperCode(code)
      expect(result.valid).toBe(false)
      expect(result.error).toContain("numberOfResultsMapper")
    })

    it("returns invalid for missing docsMapper", () => {
      const code = "numberOfResultsMapper = function(data) { return data.length; };"
      const result = validateMapperCode(code)
      expect(result.valid).toBe(false)
      expect(result.error).toContain("docsMapper")
    })

    it("returns invalid for syntax errors", () => {
      const code = "this is not valid javascript {"
      const result = validateMapperCode(code)
      expect(result.valid).toBe(false)
      expect(result.error).toContain("Mapper code error")
    })
  })
})
