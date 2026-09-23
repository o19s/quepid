import { beforeEach, describe, expect, it, vi } from "vitest"

describe("getQuepidRootUrl", () => {
  let getQuepidRootUrl

  beforeEach(async () => {
    vi.resetModules()
    document.body.innerHTML = ""
    delete document.body.dataset.quepidRootUrl
    ;({ getQuepidRootUrl } = await import("utils/quepid_root"))
  })

  it("returns data-quepid-root-url from body", () => {
    document.body.dataset.quepidRootUrl = "https://example.com/quepid"
    expect(getQuepidRootUrl()).toBe("https://example.com/quepid")
  })

  it("returns empty string when unset", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    expect(getQuepidRootUrl()).toBe("")
    expect(warn).toHaveBeenCalledOnce()
    warn.mockClear()
    expect(getQuepidRootUrl()).toBe("")
    expect(warn).not.toHaveBeenCalled()
  })
})
