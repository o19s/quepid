import { buildControllerFixture } from "../support/controller_fixture"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import FlashController from "controllers/flash_controller"

function buildController({ channel = "main", duration = 5000 } = {}) {
  const controller = buildControllerFixture(FlashController, {
    element: document.createElement("div"),
    targets: {
      message: document.createElement("span")
    }
  })
  controller.element.appendChild(controller.messageTarget)
  controller.channelValue = channel
  controller.durationValue = duration
  return controller
}

function connect(controller) {
  return () => FlashController.prototype.disconnect.call(controller)
}

function show(controller, detail) {
  controller.onDocumentShow(new CustomEvent("flash:show", { detail }))
}

function hide(controller, detail) {
  controller.onDocumentHide(new CustomEvent("flash:hide", { detail }))
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

    show(controller, { type: "success", message: "Saved!", target: "main" })

    expect(controller.messageTarget.textContent).toBe("Saved!")
    expect(controller.element.classList.contains("show")).toBe(true)
    expect(controller.element.classList.contains("alert-success")).toBe(true)
    expect(controller.element.classList.contains("alert-danger")).toBe(false)
  })

  it("ignores events dispatched on a different channel", () => {
    const controller = buildController({ channel: "search-error" })
    disconnect = connect(controller)

    show(controller, { type: "success", message: "Saved!", target: "main" })

    expect(controller.element.classList.contains("show")).toBe(false)
  })

  it("adds alert-danger only for error flashes", () => {
    const controller = buildController()
    disconnect = connect(controller)

    show(controller, { type: "error", message: "Failed!", target: "main" })

    expect(controller.element.classList.contains("alert-danger")).toBe(true)
    expect(controller.element.classList.contains("alert-success")).toBe(false)
  })

  it("auto-hides after its duration", () => {
    const controller = buildController({ duration: 5000 })
    disconnect = connect(controller)

    show(controller, { type: "success", message: "Saved!", target: "main" })
    expect(controller.element.classList.contains("show")).toBe(true)

    vi.advanceTimersByTime(5000)

    expect(controller.element.classList.contains("show")).toBe(false)
  })

  it("never auto-hides when duration is -1", () => {
    const controller = buildController({ channel: "search-error", duration: -1 })
    disconnect = connect(controller)

    show(controller, { type: "error", message: "search failed", target: "search-error" })
    vi.advanceTimersByTime(60000)

    expect(controller.element.classList.contains("show")).toBe(true)
  })

  it("renders message as markup when html: true", () => {
    const controller = buildController({ channel: "search-error" })
    disconnect = connect(controller)

    show(controller, { type: "error", message: "swap to <code>https</code>", target: "search-error", html: true })

    expect(controller.messageTarget.innerHTML).toBe("swap to <code>https</code>")
    expect(controller.messageTarget.querySelector("code").textContent).toBe("https")
  })

  it("renders structured parts as text plus safe links, never parsing the text as markup", () => {
    const controller = buildController({ channel: "search-error" })
    disconnect = connect(controller)

    show(controller, {
      type: "error",
      message: {
        parts: [
          { text: "Check <b>your</b> " },
          { text: "endpoint", href: "http://solr.test/select?q=<x>" },
          { text: " or " },
          { text: "this", href: "javascript:alert(1)" }
        ]
      },
      target: "search-error"
    })

    const links = controller.messageTarget.querySelectorAll("a")
    expect(controller.messageTarget.textContent).toBe("Check <b>your</b> endpoint or this")
    expect(controller.messageTarget.querySelector("b")).toBeNull()
    expect(links).toHaveLength(1)
    expect(links[0].textContent).toBe("endpoint")
    expect(links[0].getAttribute("href")).toBe("http://solr.test/select?q=%3Cx%3E")
    expect(links[0].getAttribute("target")).toBe("_blank")
    expect(links[0].getAttribute("rel")).toBe("noopener noreferrer")
  })

  it("keeps plain string messages as text", () => {
    const controller = buildController({ channel: "search-error" })
    disconnect = connect(controller)

    show(controller, { type: "error", message: "bad <a href=\"x\">link</a>", target: "search-error" })

    expect(controller.messageTarget.querySelector("a")).toBeNull()
    expect(controller.messageTarget.textContent).toBe("bad <a href=\"x\">link</a>")
  })

  it("hides on a flash:hide event for its channel", () => {
    const controller = buildController()
    disconnect = connect(controller)

    show(controller, { type: "success", message: "Saved!", target: "main" })
    hide(controller, { target: "main" })

    expect(controller.element.classList.contains("show")).toBe(false)
  })

  it("treats an empty message as a hide", () => {
    const controller = buildController()
    disconnect = connect(controller)

    show(controller, { type: "success", message: "Saved!", target: "main" })
    show(controller, { type: "success", message: "", target: "main" })

    expect(controller.element.classList.contains("show")).toBe(false)
  })

  it("hide() clears state (dismiss button action)", () => {
    const controller = buildController()
    disconnect = connect(controller)

    show(controller, { type: "error", message: "Failed!", target: "main" })
    FlashController.prototype.hide.call(controller)

    expect(controller.element.classList.contains("show")).toBe(false)
    expect(controller.element.classList.contains("alert-danger")).toBe(false)
    expect(controller.element.classList.contains("alert-success")).toBe(false)
  })

  it("cancels a pending auto-hide on disconnect", () => {
    const controller = buildController({ duration: 5000 })
    const teardown = connect(controller)
    show(controller, { type: "success", message: "Saved!", target: "main" })
    const hideSpy = vi.spyOn(controller, "hide")

    teardown()
    disconnect = null
    vi.advanceTimersByTime(5000)

    expect(hideSpy).not.toHaveBeenCalled()
    expect(controller.element.classList.contains("show")).toBe(true)
  })
})
