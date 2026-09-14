import { describe, expect, it, vi } from "vitest"
import { showStatusMessage } from "./status_message"

describe("status_message", () => {
  it("does nothing when the element is missing", () => {
    expect(() => showStatusMessage(null, { message: "hi" })).not.toThrow()
  })

  it("sets textContent from message", () => {
    const el = document.createElement("span")
    showStatusMessage(el, { message: "Saved" })
    expect(el.textContent).toBe("Saved")
  })

  it("sets innerHTML from html, taking precedence over message", () => {
    const el = document.createElement("span")
    showStatusMessage(el, { html: "<i></i> Saved", message: "ignored" })
    expect(el.innerHTML).toBe("<i></i> Saved")
  })

  it("replaces className wholesale when given", () => {
    const el = document.createElement("div")
    el.className = "alert d-none"
    showStatusMessage(el, { message: "Oops", className: "alert alert-danger" })
    expect(el.className).toBe("alert alert-danger")
  })

  it("removes variantClasses and adds variantClass, preserving other classes", () => {
    const el = document.createElement("span")
    el.className = "ms-2 text-warning"
    showStatusMessage(el, {
      message: "Saved",
      variantClass: "text-success",
      variantClasses: ["text-warning", "text-success", "text-danger"]
    })
    expect(el.className).toBe("ms-2 text-success")
  })

  it("removes variantClasses without adding one when variantClass is omitted", () => {
    const el = document.createElement("span")
    el.className = "ms-2 text-success"
    showStatusMessage(el, {
      message: "",
      variantClasses: ["text-warning", "text-success", "text-danger"]
    })
    expect(el.className).toBe("ms-2")
  })

  it("auto-hides plain text content after autoHideMs when unchanged", () => {
    vi.useFakeTimers()
    const el = document.createElement("span")
    showStatusMessage(el, { message: "Saved", autoHideMs: 2000 })
    expect(el.textContent).toBe("Saved")

    vi.advanceTimersByTime(2000)
    expect(el.textContent).toBe("")
    vi.useRealTimers()
  })

  it("auto-hides html content after autoHideMs when unchanged", () => {
    vi.useFakeTimers()
    const el = document.createElement("span")
    showStatusMessage(el, { html: "<i></i> Saved", autoHideMs: 2000 })

    vi.advanceTimersByTime(2000)
    expect(el.innerHTML).toBe("")
    vi.useRealTimers()
  })

  it("does not clear content if it changed before autoHideMs elapses (race guard)", () => {
    vi.useFakeTimers()
    const el = document.createElement("span")
    showStatusMessage(el, { message: "Saved", autoHideMs: 2000 })

    el.textContent = "Error saving"
    vi.advanceTimersByTime(2000)

    expect(el.textContent).toBe("Error saving")
    vi.useRealTimers()
  })

  it("calls onExpire instead of clearing content when provided", () => {
    vi.useFakeTimers()
    const el = document.createElement("div")
    el.style.display = "block"
    const onExpire = vi.fn((element) => {
      element.style.display = "none"
    })

    showStatusMessage(el, { message: "Saved", autoHideMs: 5000, onExpire })
    vi.advanceTimersByTime(5000)

    expect(onExpire).toHaveBeenCalledWith(el)
    expect(el.style.display).toBe("none")
    expect(el.textContent).toBe("Saved")
    vi.useRealTimers()
  })

  it("does not schedule auto-hide when autoHideMs is not set", () => {
    vi.useFakeTimers()
    const el = document.createElement("span")
    showStatusMessage(el, { message: "Saved" })

    vi.advanceTimersByTime(100000)
    expect(el.textContent).toBe("Saved")
    vi.useRealTimers()
  })
})
