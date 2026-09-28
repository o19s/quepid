import { describe, expect, it, vi } from "vitest"
import { createNavigationRuntime } from "utils/navigation_runtime"

describe("navigation runtime", () => {
  it("tracks the current case and try and preserves query sorting", () => {
    const assign = vi.fn()
    const runtime = createNavigationRuntime({
      location: { href: "https://quepid.example.test/case/5/try/1?sort=score&reverse=true", search: "?sort=score&reverse=true" },
      window: { location: { assign } }
    })

    runtime.navigationCompleted({ caseNo: 5, tryNo: 1 })
    runtime.navigateTo({ tryNo: 2 })

    expect(runtime.getCaseNo()).toBe(5)
    expect(runtime.getTryNo()).toBe(1)
    expect(assign).toHaveBeenCalledWith("https://quepid.example.test/case/5/try/2?sort=score&reverse=true")
  })

  it("keeps protocol and proxy URL behavior framework-free", () => {
    const runtime = createNavigationRuntime({
      location: { href: "https://quepid.example.test/case/5", protocol: "https:", search: "" },
      window: { location: { assign: vi.fn() } }
    })

    expect(runtime.getQuepidRootUrl()).toBe("https://quepid.example.test")
    expect(runtime.needToRedirectQuepidProtocol("http://search.example.test/select")).toBe(true)
    expect(runtime.getQuepidProxyUrl(7)).toBe("https://quepid.example.test/proxy/fetch?search_endpoint_id=7&url=")
  })
})
