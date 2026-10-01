import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import JudgeActivityPollController from "controllers/judge_activity_poll_controller"

function buildController(initialHtml) {
  const controller = Object.create(JudgeActivityPollController.prototype)
  controller.element = document.createElement("tbody")
  controller.element.innerHTML = initialHtml
  controller.urlValue = "/books/1/judge_activity"
  controller.intervalMsValue = 1000
  return controller
}

const ACTIVE_ROW = '<tr data-actively-judging="true"></tr>'
const INACTIVE_ROW = '<tr data-actively-judging="false"></tr>'

// A microtask tick lets the real MutationObserver's callback (which batches
// via the microtask queue, not synchronously) run before assertions.
function nextTick() {
  return new Promise((resolve) => queueMicrotask(resolve))
}

describe("JudgeActivityPollController", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("does not poll when nothing is actively judging on connect", async () => {
    const controller = buildController(INACTIVE_ROW)
    global.fetch = vi.fn()

    controller.connect()
    await nextTick()
    vi.advanceTimersByTime(5000)

    expect(global.fetch).not.toHaveBeenCalled()
    controller.disconnect()
  })

  it("polls while a row is actively judging, and stops once a poll response has nothing active", async () => {
    const controller = buildController(ACTIVE_ROW)
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(INACTIVE_ROW) })

    controller.connect()
    await nextTick()

    await vi.advanceTimersByTimeAsync(1000)
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenCalledWith("/books/1/judge_activity", { headers: { Accept: "text/html" } })
    expect(controller.element.innerHTML).toBe(INACTIVE_ROW)

    // The fetched content is no longer active, so polling must have stopped -
    // advancing well past another interval should not trigger a second fetch.
    await vi.advanceTimersByTimeAsync(5000)
    expect(global.fetch).toHaveBeenCalledTimes(1)

    controller.disconnect()
  })

  it("keeps polling across multiple intervals while still active", async () => {
    const controller = buildController(ACTIVE_ROW)
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(ACTIVE_ROW) })

    controller.connect()
    await nextTick()

    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(1000)
    expect(global.fetch).toHaveBeenCalledTimes(2)

    controller.disconnect()
  })

  it("starts polling once a row becomes active later (e.g. a live broadcast update)", async () => {
    const controller = buildController(INACTIVE_ROW)
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(INACTIVE_ROW) })

    controller.connect()
    await nextTick()
    vi.advanceTimersByTime(5000)
    expect(global.fetch).not.toHaveBeenCalled()

    controller.element.innerHTML = ACTIVE_ROW
    await nextTick()

    await vi.advanceTimersByTimeAsync(1000)
    expect(global.fetch).toHaveBeenCalledTimes(1)

    controller.disconnect()
  })

  it("does not touch the DOM when a poll fetches content identical to what's already shown", async () => {
    const controller = buildController(ACTIVE_ROW)
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(ACTIVE_ROW) })

    controller.connect()
    await nextTick()

    const original = controller.element.firstChild
    await vi.advanceTimersByTimeAsync(1000)

    expect(global.fetch).toHaveBeenCalledTimes(1)
    // A real DOM write (even of identical markup) would replace this node -
    // same node reference proves the no-op path was taken, not just equal text.
    expect(controller.element.firstChild).toBe(original)
  })

  it("ignores a chart's random wrapper id when deciding whether a poll changed anything", async () => {
    const rowWithChart = (chartId) =>
      `<tr data-actively-judging="true"><td><div id="chart-${chartId}"></div></td></tr>`
    const controller = buildController(rowWithChart("a".repeat(32)))
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(rowWithChart("b".repeat(32))) })

    controller.connect()
    await nextTick()

    const original = controller.element.firstChild
    await vi.advanceTimersByTimeAsync(1000)

    // Only the random chart id differs between what's on screen and what was
    // fetched - that alone must not count as a real change.
    expect(controller.element.firstChild).toBe(original)
  })

  it("stops polling on disconnect", async () => {
    const controller = buildController(ACTIVE_ROW)
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(ACTIVE_ROW) })

    controller.connect()
    await nextTick()
    controller.disconnect()

    await vi.advanceTimersByTimeAsync(5000)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
