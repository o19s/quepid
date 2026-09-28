import { describe, expect, it } from "vitest"
import { createConfigurationRuntime } from "utils/configuration_runtime"

describe("configuration runtime", () => {
  it("preserves the core bootstrap configuration contract", () => {
    const runtime = createConfigurationRuntime()

    runtime.setCommunalScorersOnly("true")
    runtime.setQueryListSortable("false")
    runtime.setCaseNo("5")
    runtime.setTryNo("2")

    expect(runtime.isCommunalScorersOnly()).toBe(true)
    expect(runtime.isQueryListSortable()).toBe(false)
    expect(runtime.getCaseNo()).toBe(5)
    expect(runtime.getTryNo()).toBe(2)
  })
})
