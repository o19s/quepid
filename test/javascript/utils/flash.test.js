import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { hideFlash, showFlash } from "utils/flash"

describe("flash", () => {
  let showListener
  let hideListener

  beforeEach(() => {
    showListener = vi.fn()
    hideListener = vi.fn()
    document.addEventListener("flash:show", showListener)
    document.addEventListener("flash:hide", hideListener)
  })

  afterEach(() => {
    document.removeEventListener("flash:show", showListener)
    document.removeEventListener("flash:hide", hideListener)
  })

  it("dispatches flash:show with the type, message, and default target", () => {
    showFlash("success", "All queries finished successfully!")

    expect(showListener).toHaveBeenCalledTimes(1)
    expect(showListener.mock.calls[0][0].detail).toEqual({
      type: "success",
      message: "All queries finished successfully!",
      target: "main",
      html: false
    })
  })

  it("dispatches flash:show with an explicit target", () => {
    showFlash("error", "search failed", "search-error")

    expect(showListener.mock.calls[0][0].detail).toEqual({
      type: "error",
      message: "search failed",
      target: "search-error",
      html: false
    })
  })

  it("dispatches flash:show with html: true when requested", () => {
    showFlash("error", "<code>https</code>", "search-error", { html: true })

    expect(showListener.mock.calls[0][0].detail).toEqual({
      type: "error",
      message: "<code>https</code>",
      target: "search-error",
      html: true
    })
  })

  it("dispatches flash:hide with the default target", () => {
    hideFlash()

    expect(hideListener).toHaveBeenCalledTimes(1)
    expect(hideListener.mock.calls[0][0].detail).toEqual({ target: "main" })
  })

  it("dispatches flash:hide with an explicit target", () => {
    hideFlash("search-error")

    expect(hideListener.mock.calls[0][0].detail).toEqual({ target: "search-error" })
  })
})
