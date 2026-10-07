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

  it("starts at try 1 when navigating to a different case", () => {
    const assign = vi.fn()
    const runtime = createNavigationRuntime({
      location: { href: "https://quepid.example.test/case/5/try/4", search: "" },
      window: { location: { assign } }
    })

    runtime.navigateTo({ caseNo: "8" })

    expect(assign).toHaveBeenCalledWith("https://quepid.example.test/case/8/try/1")
  })

  it("builds the reload link that swaps Quepid to the search engine's protocol", () => {
    const at = (href) => createNavigationRuntime({ location: { href }, window: {} })

    expect(at("http://localhost:3000/case/5/try/1?sort=name").swapQuepidUrlTLS())
      .toEqual(["https://localhost/case/5/try/1?protocolToSwitchTo=https", "https"])
    expect(at("https://quepid.example.test/case/5/try/1").swapQuepidUrlTLS())
      .toEqual(["http://quepid.example.test/case/5/try/1?protocolToSwitchTo=http", "http"])
    expect(at("https://quepid.example.test/case/5").getQuepidProtocol()).toBe("http")
    expect(at("http://quepid.example.test/case/5").getQuepidProtocol()).toBe("https")

    const runtime = at("https://quepid.example.test/case/5")
    expect(runtime.appendQueryParams("/a", "x=1")).toBe("/a?x=1")
    expect(runtime.appendQueryParams("/a?y=2", "x=1")).toBe("/a?y=2&x=1")
    expect(runtime.needToRedirectQuepidProtocol("")).toBe(false)
    expect(runtime.createSearchEndpointLink(7)).toBe("https://quepid.example.test/search_endpoints/7")
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

describe("navigation runtime protocol and url helpers", () => {
  const runtimeAt = (href, protocol) =>
    createNavigationRuntime({ location: { href, protocol, search: "" }, window: {} })

  it("asks to redirect only when the page and search protocols differ", () => {
    const https = runtimeAt("https://q.test/case/1", "https:")
    expect(https.needToRedirectQuepidProtocol("http://search.test")).toBe(true)
    expect(https.needToRedirectQuepidProtocol("https://search.test")).toBe(false)
    expect(https.needToRedirectQuepidProtocol("")).toBe(false)
    const http = runtimeAt("http://q.test/case/1", "http:")
    expect(http.needToRedirectQuepidProtocol("https://search.test")).toBe(true)
    expect(http.needToRedirectQuepidProtocol("http://search.test")).toBe(false)
  })

  it("finds the root url whether or not the location ends in a slash", () => {
    expect(runtimeAt("https://q.test/sub/case/1/try/2", "https:").getQuepidRootUrl()).toBe("https://q.test/sub")
    expect(runtimeAt("https://q.test/case/", "https:").getQuepidRootUrl()).toBe("https://q.test")
    expect(runtimeAt("https://q.test", "https:").getQuepidRootUrl()).toBe("https://q.test")
  })
})
