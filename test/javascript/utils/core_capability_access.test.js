import { describe, expect, it } from "vitest"
import { getCoreCapabilities } from "utils/core_capability_access"

describe("getCoreCapabilities", () => {
  it("returns the module-owned capability singleton", () => {
    expect(getCoreCapabilities()).toHaveProperty("queryCapabilities")
  })
})
