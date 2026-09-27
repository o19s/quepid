import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import AutoDismissController from "./auto_dismiss_controller"

function buildController(element, delayValue = 5000) {
  const controller = Object.create(AutoDismissController.prototype)
  controller.element = element
  controller.delayValue = delayValue
  return controller
}

describe("AutoDismissController", () => {
  let element
  let closeSpy

  beforeEach(() => {
    vi.useFakeTimers()
    element = document.createElement("div")
    document.body.appendChild(element)

    closeSpy = vi.fn()
    window.bootstrap = { Alert: { getOrCreateInstance: () => ({ close: closeSpy }) } }
  })

  afterEach(() => {
    element.remove()
    delete window.bootstrap
    vi.useRealTimers()
  })

  it("dismisses via the Bootstrap Alert API after the delay elapses", () => {
    const controller = buildController(element)
    AutoDismissController.prototype.connect.call(controller)

    vi.advanceTimersByTime(5000)

    expect(closeSpy).toHaveBeenCalledOnce()
  })

  it("does not dismiss before the delay elapses", () => {
    const controller = buildController(element)
    AutoDismissController.prototype.connect.call(controller)

    vi.advanceTimersByTime(4999)

    expect(closeSpy).not.toHaveBeenCalled()
  })

  it("pauses the timer on mouseenter and reschedules on mouseleave", () => {
    const controller = buildController(element)
    AutoDismissController.prototype.connect.call(controller)

    vi.advanceTimersByTime(4000)
    element.dispatchEvent(new Event("mouseenter"))
    vi.advanceTimersByTime(5000)
    expect(closeSpy).not.toHaveBeenCalled()

    element.dispatchEvent(new Event("mouseleave"))
    vi.advanceTimersByTime(5000)
    expect(closeSpy).toHaveBeenCalledOnce()
  })

  it("pauses the timer on focusin and reschedules on focusout", () => {
    const controller = buildController(element)
    AutoDismissController.prototype.connect.call(controller)

    vi.advanceTimersByTime(4000)
    element.dispatchEvent(new Event("focusin"))
    vi.advanceTimersByTime(5000)
    expect(closeSpy).not.toHaveBeenCalled()

    element.dispatchEvent(new Event("focusout"))
    vi.advanceTimersByTime(5000)
    expect(closeSpy).toHaveBeenCalledOnce()
  })

  it("falls back to removing the element when Bootstrap is unavailable", () => {
    delete window.bootstrap
    const controller = buildController(element)
    AutoDismissController.prototype.connect.call(controller)

    vi.advanceTimersByTime(5000)

    expect(element.isConnected).toBe(false)
  })

  it("cancels the pending timeout on disconnect", () => {
    const controller = buildController(element)
    AutoDismissController.prototype.connect.call(controller)
    AutoDismissController.prototype.disconnect.call(controller)

    vi.advanceTimersByTime(5000)

    expect(closeSpy).not.toHaveBeenCalled()
  })
})
