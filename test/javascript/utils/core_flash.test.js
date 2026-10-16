import { afterEach, describe, expect, it, vi } from "vitest"
import coreFlash from "utils/core_flash"
import { SearchError } from "utils/search_error"

describe("coreFlash", () => {
  const listeners = []

  function listen(name) {
    const listener = vi.fn()
    document.addEventListener(name, listener)
    listeners.push([name, listener])
    return listener
  }

  afterEach(() => {
    listeners.splice(0).forEach(([name, listener]) => document.removeEventListener(name, listener))
  })

  it("delivers controller messages to the main target by default", () => {
    const listener = listen("flash:show")
    coreFlash.show("success", "Saved")
    expect(listener.mock.calls[0][0].detail).toEqual({
      type: "success",
      message: "Saved",
      target: "main",
      html: false
    })
  })

  it("preserves structured search-error parts and explicit HTML options", () => {
    const listener = listen("flash:show")
    const error = new SearchError([{ text: "See " }, { text: "help", href: "https://example.com" }])
    coreFlash.show("error", error, "search-error")
    expect(listener.mock.calls[0][0].detail.message).toBe(error)
    expect(listener.mock.calls[0][0].detail.target).toBe("search-error")
    expect(listener.mock.calls[0][0].detail.html).toBe(false)

    coreFlash.show("error", "<code>https</code>", "search-error", { html: true })
    expect(listener.mock.calls[1][0].detail).toEqual({
      type: "error",
      message: "<code>https</code>",
      target: "search-error",
      html: true
    })
  })

  it("hides only the requested target", () => {
    const listener = listen("flash:hide")
    coreFlash.hide()
    coreFlash.hide("search-error")
    expect(listener.mock.calls.map(([event]) => event.detail)).toEqual([
      { target: "main" },
      { target: "search-error" }
    ])
  })
})
