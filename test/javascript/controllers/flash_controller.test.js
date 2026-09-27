import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import FlashController from "controllers/flash_controller"

function buildController({ channel = "main", duration = 5000 } = {}) {
  const controller = Object.create(FlashController.prototype)
  controller.element = document.createElement("div")
  controller.messageTarget = document.createElement("span")
  controller.element.appendChild(controller.messageTarget)
  controller.channelValue = channel
  controller.durationValue = duration
  return controller
}

function connect(controller) {
  FlashController.prototype.connect.call(controller)
  return () => FlashController.prototype.disconnect.call(controller)
}

describe("FlashController", () => {
  let disconnect

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    if (disconnect) disconnect()
    disconnect = null
    vi.useRealTimers()
  })

  it("shows a message dispatched on its own channel", () => {
    const controller = buildController()
    disconnect = connect(controller)

    document.dispatchEvent(
      new CustomEvent("flash:show", { detail: { type: "success", message: "Saved!", target: "main" } })
    )

    expect(controller.messageTarget.textContent).toBe("Saved!")
    expect(controller.element.classList.contains("show")).toBe(true)
    expect(controller.element.classList.contains("alert-success")).toBe(true)
    expect(controller.element.classList.contains("alert-danger")).toBe(false)
  })

  it("ignores events dispatched on a different channel", () => {
    const controller = buildController({ channel: "search-error" })
    disconnect = connect(controller)

    document.dispatchEvent(
      new CustomEvent("flash:show", { detail: { type: "success", message: "Saved!", target: "main" } })
    )

    expect(controller.element.classList.contains("show")).toBe(false)
  })

  it("adds alert-danger only for error flashes", () => {
    const controller = buildController()
    disconnect = connect(controller)

    document.dispatchEvent(
      new CustomEvent("flash:show", { detail: { type: "error", message: "Failed!", target: "main" } })
    )

    expect(controller.element.classList.contains("alert-danger")).toBe(true)
    expect(controller.element.classList.contains("alert-success")).toBe(false)
  })

  it("auto-hides after its duration", () => {
    const controller = buildController({ duration: 5000 })
    disconnect = connect(controller)

    document.dispatchEvent(
      new CustomEvent("flash:show", { detail: { type: "success", message: "Saved!", target: "main" } })
    )
    expect(controller.element.classList.contains("show")).toBe(true)

    vi.advanceTimersByTime(5000)

    expect(controller.element.classList.contains("show")).toBe(false)
  })

  it("never auto-hides when duration is -1", () => {
    const controller = buildController({ channel: "search-error", duration: -1 })
    disconnect = connect(controller)

    document.dispatchEvent(
      new CustomEvent("flash:show", {
        detail: { type: "error", message: "search failed", target: "search-error" }
      })
    )
    vi.advanceTimersByTime(60000)

    expect(controller.element.classList.contains("show")).toBe(true)
  })

  it("renders message as markup when html: true", () => {
    const controller = buildController({ channel: "search-error" })
    disconnect = connect(controller)

    document.dispatchEvent(
      new CustomEvent("flash:show", {
        detail: { type: "error", message: "swap to <code>https</code>", target: "search-error", html: true }
      })
    )

    expect(controller.messageTarget.innerHTML).toBe("swap to <code>https</code>")
    expect(controller.messageTarget.querySelector("code").textContent).toBe("https")
  })

  it("hides on a flash:hide event for its channel", () => {
    const controller = buildController()
    disconnect = connect(controller)

    document.dispatchEvent(
      new CustomEvent("flash:show", { detail: { type: "success", message: "Saved!", target: "main" } })
    )
    document.dispatchEvent(new CustomEvent("flash:hide", { detail: { target: "main" } }))

    expect(controller.element.classList.contains("show")).toBe(false)
  })

  it("treats an empty message as a hide", () => {
    const controller = buildController()
    disconnect = connect(controller)

    document.dispatchEvent(
      new CustomEvent("flash:show", { detail: { type: "success", message: "Saved!", target: "main" } })
    )
    document.dispatchEvent(
      new CustomEvent("flash:show", { detail: { type: "success", message: "", target: "main" } })
    )

    expect(controller.element.classList.contains("show")).toBe(false)
  })

  it("hide() clears state (dismiss button action)", () => {
    const controller = buildController()
    disconnect = connect(controller)

    document.dispatchEvent(
      new CustomEvent("flash:show", { detail: { type: "error", message: "Failed!", target: "main" } })
    )
    FlashController.prototype.hide.call(controller)

    expect(controller.element.classList.contains("show")).toBe(false)
    expect(controller.element.classList.contains("alert-danger")).toBe(false)
    expect(controller.element.classList.contains("alert-success")).toBe(false)
  })

  it("stops listening after disconnect", () => {
    const controller = buildController()
    const teardown = connect(controller)
    teardown()
    disconnect = null

    document.dispatchEvent(
      new CustomEvent("flash:show", { detail: { type: "success", message: "Saved!", target: "main" } })
    )

    expect(controller.element.classList.contains("show")).toBe(false)
  })
})
