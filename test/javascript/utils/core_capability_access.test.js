import { afterEach, describe, expect, it } from "vitest"
import { getCoreCapabilities } from "utils/core_capability_access"

describe("getCoreCapabilities", () => {
  afterEach(() => {
    delete window.quepidSearch
  })

  it("returns the legacy case capabilities while the compatibility runtime is active", () => {
    const capabilities = { queryCapabilities: {}, queryCommands: {} }
    window.quepidSearch = capabilities

    expect(getCoreCapabilities()).toBe(capabilities)
  })

  it("returns an empty capability group outside the browser bridge", () => {
    expect(getCoreCapabilities()).toEqual({})
  })
})
