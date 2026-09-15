import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { animateCountUp, stopCountUp } from "./count_up"

describe("count_up", () => {
  let element

  beforeEach(() => {
    vi.useFakeTimers()
    element = document.createElement("span")
    document.body.appendChild(element)
  })

  afterEach(() => {
    element.remove()
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it("renders the target value immediately when from equals to", () => {
    animateCountUp(element, 23, 23)
    expect(element.textContent).toBe("23")
  })

  it("steps from the starting value up to the target over the duration", () => {
    animateCountUp(element, 0, 10, { steps: 5, durationMs: 500 })

    vi.advanceTimersByTime(100)
    expect(element.textContent).toBe("2")

    vi.advanceTimersByTime(300)
    expect(element.textContent).toBe("8")

    vi.advanceTimersByTime(100)
    expect(element.textContent).toBe("10")
  })

  it("steps downward when the target is lower than the start", () => {
    animateCountUp(element, 10, 0, { steps: 5, durationMs: 500 })

    vi.advanceTimersByTime(500)
    expect(element.textContent).toBe("0")
  })

  it("uses the default steps and duration when no options are given", () => {
    animateCountUp(element, 0, 10)

    vi.advanceTimersByTime(499)
    expect(element.textContent).not.toBe("10")

    vi.advanceTimersByTime(1)
    expect(element.textContent).toBe("10")
  })

  it("honors a custom steps count distinct from the default", () => {
    animateCountUp(element, 0, 10, { steps: 2, durationMs: 100 })

    vi.advanceTimersByTime(50)
    expect(element.textContent).toBe("5")

    vi.advanceTimersByTime(50)
    expect(element.textContent).toBe("10")
  })

  it("stops exactly at the target and does not overshoot on further ticks", () => {
    animateCountUp(element, 0, 10, { steps: 5, durationMs: 500 })
    vi.advanceTimersByTime(500)
    expect(element.textContent).toBe("10")

    vi.advanceTimersByTime(500)
    expect(element.textContent).toBe("10")
  })

  it("cancels an in-flight animation when a new one starts on the same element", () => {
    animateCountUp(element, 0, 100, { steps: 5, durationMs: 500 })
    vi.advanceTimersByTime(100)
    expect(element.textContent).toBe("20")

    animateCountUp(element, 20, 25, { steps: 5, durationMs: 500 })
    vi.advanceTimersByTime(500)
    expect(element.textContent).toBe("25")
  })

  it("stopCountUp halts a running animation", () => {
    animateCountUp(element, 0, 10, { steps: 5, durationMs: 500 })
    vi.advanceTimersByTime(100)
    expect(element.textContent).toBe("2")

    stopCountUp(element)
    vi.advanceTimersByTime(400)
    expect(element.textContent).toBe("2")
  })

  it("stopCountUp on an element with no running animation is a no-op", () => {
    expect(() => stopCountUp(element)).not.toThrow()
  })
})
