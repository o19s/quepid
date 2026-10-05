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
  return element
}

function renderThrough(controller, element) {
  const render = vi.fn().mockResolvedValue(undefined)
  const event = { target: element, detail: { render } }
  controller.guard(event)
  return { render, wrapped: event.detail.render }
}

describe("StaleStreamGuardController", () => {
  afterEach(() => {
    document.body.innerHTML = ""
  })

  function setup(shownAt) {
    document.body.innerHTML = `<div id="progress" data-rendered-at="${shownAt}"></div>`
    return Object.create(StaleStreamGuardController.prototype)
  }

  it("renders an update newer than what is shown", async () => {
    const controller = setup(100)
    const element = stream("progress", 200)
    const { render, wrapped } = renderThrough(controller, element)

    await wrapped(element)

    expect(render).toHaveBeenCalledWith(element)
  })

  it("skips an update older than what is shown, checked when Turbo renders it", async () => {
    const controller = setup(100)
    const late = stream("progress", 150)
    const { render, wrapped } = renderThrough(controller, late)
    // "Done" (rendered at 300) lands while the late update waits for a repaint.
    document.getElementById("progress").dataset.renderedAt = "300"

    await wrapped(late)

    expect(render).not.toHaveBeenCalled()
  })

  it("leaves elements without a timestamp, and other actions, alone", async () => {
    const controller = setup(100)
    document.body.innerHTML = `<div id="plain"></div>`
    const plain = stream("plain", 50)
    const append = stream("progress", 50, "append")

    const first = renderThrough(controller, plain)
    await first.wrapped(plain)
    const event = { target: append, detail: { render: vi.fn() } }
    const original = event.detail.render
    controller.guard(event)

    expect(first.render).toHaveBeenCalled()
    expect(event.detail.render).toBe(original)
  })
})
