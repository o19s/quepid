import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import AutoDismissController from "controllers/auto_dismiss_controller"
import { buildControllerFixture } from "../support/controller_fixture"

describe("Rails flash lifecycle", () => {
  let controller

  beforeEach(() => {
    vi.useFakeTimers()
    const element = document.createElement("div")
    element.innerHTML = '<button type="button">Close</button>'
    document.body.append(element)
    controller = buildControllerFixture(AutoDismissController, {
      element,
      values: { delay: 5000 }
    })
  })

  afterEach(() => {
    controller.disconnect()
    document.body.replaceChildren()
    delete window.bootstrap
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("dismisses at five seconds through Bootstrap", () => {
    const close = vi.fn()
    window.bootstrap = { Alert: { getOrCreateInstance: vi.fn(() => ({ close })) } }
    controller.connect()
    vi.advanceTimersByTime(4999)
    expect(close).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(close).toHaveBeenCalledOnce()
  })

  it("pauses while hovered and restarts a full delay after leaving", () => {
    const matches = vi.spyOn(controller.element, "matches")
    controller.connect()
    vi.advanceTimersByTime(3000)
    matches.mockReturnValue(true)
    controller.pause()
    controller.schedule()
    vi.advanceTimersByTime(6000)
    expect(controller.element.isConnected).toBe(true)
    matches.mockReturnValue(false)
    controller.schedule()
    vi.advanceTimersByTime(4999)
    expect(controller.element.isConnected).toBe(true)
    vi.advanceTimersByTime(1)
    expect(controller.element.isConnected).toBe(false)
  })

  it("stays paused when hover ends but keyboard focus remains inside", () => {
    controller.connect()
    controller.element.querySelector("button").focus()
    controller.pause()
    controller.schedule()
    vi.advanceTimersByTime(6000)
    expect(controller.element.isConnected).toBe(true)
    controller.element.querySelector("button").blur()
    controller.schedule()
    vi.advanceTimersByTime(5000)
    expect(controller.element.isConnected).toBe(false)
  })

  it("clears disconnected timers and schedules only once on reconnection", () => {
    controller.connect()
    vi.advanceTimersByTime(3000)
    controller.disconnect()
    vi.advanceTimersByTime(6000)
    expect(controller.element.isConnected).toBe(true)
    controller.connect()
    controller.schedule()
    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(5000)
    expect(controller.element.isConnected).toBe(false)
  })

  it("ignores an alert removed before its timer fires", () => {
    const getOrCreateInstance = vi.fn()
    window.bootstrap = { Alert: { getOrCreateInstance } }
    controller.connect()
    controller.element.remove()
    vi.advanceTimersByTime(5000)
    expect(getOrCreateInstance).not.toHaveBeenCalled()
  })
})
