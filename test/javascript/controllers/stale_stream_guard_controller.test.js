import { afterEach, describe, expect, it, vi } from "vitest"
import StaleStreamGuardController from "controllers/stale_stream_guard_controller"

// A stand-in for Turbo's <turbo-stream>: its attributes and templateContent.
function stream(target, renderedAt, action = "replace") {
  const element = document.createElement("div")
  element.setAttribute("action", action)
  element.setAttribute("target", target)
  const template = document.createElement("template")
  template.innerHTML = `<!-- partial --><div id="${target}" data-rendered-at="${renderedAt}"></div>`
  Object.defineProperty(element, "templateContent", { get: () => template.content.cloneNode(true) })
  document.body.appendChild(element)
  return element
}

// Dispatches turbo:before-stream-render from the stream, as Turbo does, and
// returns the render Turbo would call afterwards.
function arrive(element) {
  const render = vi.fn().mockResolvedValue(undefined)
  const event = new CustomEvent("turbo:before-stream-render", { bubbles: true, cancelable: true, detail: { render } })
  element.dispatchEvent(event)
  return { render, wrapped: event.detail.render }
}

describe("StaleStreamGuardController", () => {
  let controller

  function setup(shownAt) {
    document.body.innerHTML = `<div id="progress" data-rendered-at="${shownAt}"></div>`
    controller = Object.create(StaleStreamGuardController.prototype)
    controller.connect()
  }

  afterEach(() => {
    controller?.disconnect()
    document.body.innerHTML = ""
  })

  it("renders an update newer than what is shown", async () => {
    setup(100)
    const element = stream("progress", 200)
    const { render, wrapped } = arrive(element)

    await wrapped(element)

    expect(render).toHaveBeenCalledWith(element)
  })

  it("skips an update older than what is shown, checked when Turbo renders it", async () => {
    setup(100)
    const late = stream("progress", 150)
    const { render, wrapped } = arrive(late)
    // "Done" (rendered at 300) lands while the late update waits for a repaint.
    document.getElementById("progress").dataset.renderedAt = "300"

    await wrapped(late)

    expect(render).not.toHaveBeenCalled()
  })

  it("leaves elements without a timestamp, and other actions, alone", async () => {
    setup(100)
    document.getElementById("progress").removeAttribute("data-rendered-at")
    const plain = stream("progress", 50)
    const first = arrive(plain)
    await first.wrapped(plain)

    const append = arrive(stream("progress", 50, "append"))

    expect(first.render).toHaveBeenCalled()
    expect(append.wrapped).toBe(append.render)
  })

  it("stops watching once disconnected", () => {
    setup(100)
    controller.disconnect()
    const { render, wrapped } = arrive(stream("progress", 50))

    expect(wrapped).toBe(render)
  })
})
