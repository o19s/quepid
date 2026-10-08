import { describe, expect, it } from "vitest"
import fc from "fast-check"
import { createNavigationRuntime } from "utils/navigation_runtime"

describe("workspace navigation", () => {
  it("preserves sorting and carries the tour flag only when explicitly requested", () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 100000 }),
      fc.integer({ min: 1, max: 1000 }),
      fc.constantFrom("score", "query", "manual"),
      fc.boolean(), fc.boolean(),
      (caseNo, tryNo, sort, reverse, startTour) => {
        let destination
        const location = new URL(`https://example.test/quepid/case/1/try/1?sort=${sort}&reverse=${reverse}&showWizard=true`)
        const runtime = createNavigationRuntime({
          location,
          window: { location: { assign: url => { destination = new URL(url) } } }
        })
        runtime.navigateTo({ caseNo, tryNo, startTour })
        expect(destination.pathname).toBe(`/quepid/case/${caseNo}/try/${tryNo}`)
        expect(destination.searchParams.get("sort")).toBe(sort)
        expect(destination.searchParams.get("reverse")).toBe(String(reverse))
        expect(destination.searchParams.get("startTour")).toBe(startTour ? "true" : null)
        expect(destination.searchParams.has("showWizard")).toBe(false)
      }
    ))
  })
})
