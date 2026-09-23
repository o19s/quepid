import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { downloadBlob } from "utils/download_file"

describe("downloadBlob", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    URL.createObjectURL = vi.fn(() => "blob:mock-url")
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("clicks a temporary anchor pointing at the blob, then cleans up", () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
    const blob = new Blob([ "a,b,c" ], { type: "text/csv" })

    downloadBlob(blob, "case_general.csv")

    expect(URL.createObjectURL).toHaveBeenCalledWith(blob)
    expect(clickSpy).toHaveBeenCalledOnce()
    expect(document.querySelectorAll("a[download]")).toHaveLength(0)
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
  })

  it("defers revoking the object URL instead of doing it in the same tick as click()", () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
    const blob = new Blob([ "a,b,c" ], { type: "text/csv" })

    downloadBlob(blob, "case_general.csv")
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()

    vi.runAllTimers()

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url")
  })
})
