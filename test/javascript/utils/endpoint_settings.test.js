import { describe, expect, it } from "vitest"
import { endpointSettings, formatEndpointHeaders } from "utils/endpoint_settings"

describe("endpoint settings", () => {
  it.each([undefined, null, "", "null", "{invalid", false, 0])("preserves non-object headers %s", value => {
    expect(formatEndpointHeaders(value)).toBe(value)
  })

  it.each([{ a: "b" }, ["a", "b"], []])("formats object headers without imposing parser policy", value => {
    expect(formatEndpointHeaders(value)).toBe(JSON.stringify(value, null, 2))
  })

  it("preserves missing fields and leaves defaults and surface-specific fields to callers", () => {
    expect(endpointSettings({ id: 4, endpointUrl: null })).toEqual({
      searchEndpointId: 4,
      searchEngine: undefined,
      searchUrl: null,
      apiMethod: undefined,
      customHeaders: undefined,
      proxyRequests: undefined,
      basicAuthCredential: undefined,
      mapperCode: undefined
    })
  })
})
