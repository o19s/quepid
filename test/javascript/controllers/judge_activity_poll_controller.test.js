import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import JudgeActivityPollController from "controllers/judge_activity_poll_controller"

function buildController() {
  const controller = Object.create(JudgeActivityPollController.prototype)
  controller.element = document.createElement("tbody")
  controller.element.innerHTML = '<tr id="judge-row-7"></tr>'
  document.body.append(controller.element)
  controller.urlValue = "/books/1/judge_activity?existing=1"
  controller.intervalMsValue = 1000
  return controller
}

describe("JudgeActivityPollController", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal("Turbo", { renderStreamMessage: vi.fn() })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => "<turbo-stream></turbo-stream>" }))
  })

  afterEach(() => {
    document.body.replaceChildren()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("recovers missed first-judge broadcasts even while the table is idle", async () => {
    const controller = buildController()
    controller.connect()
    await vi.advanceTimersByTimeAsync(1000)
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url] = fetch.mock.calls[0]
    expect(url.searchParams.get("existing")).toBe("1")
    expect(url.searchParams.get("known_judge_ids")).toBe("7")
    expect(globalThis.Turbo.renderStreamMessage).toHaveBeenCalledWith("<turbo-stream></turbo-stream>")
    controller.disconnect()
  })

  it("keeps polling across intervals", async () => {
    const controller = buildController()
    controller.connect()
    await vi.advanceTimersByTimeAsync(2000)
    expect(fetch).toHaveBeenCalledTimes(2)
    controller.disconnect()
  })

  it("stops polling on disconnect", async () => {
    const controller = buildController()
    controller.connect()
    controller.disconnect()
    await vi.advanceTimersByTimeAsync(5000)
    expect(fetch).not.toHaveBeenCalled()
  })

  it("retries a failed request on the next interval", async () => {
    fetch.mockRejectedValueOnce(new Error("offline"))
    const controller = buildController()
    controller.connect()
    await vi.advanceTimersByTimeAsync(2000)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(globalThis.Turbo.renderStreamMessage).toHaveBeenCalledTimes(1)
    controller.disconnect()
  })

  it("does not overlap slow requests or apply a response after leaving the page", async () => {
    let complete
    fetch.mockReturnValue(new Promise((resolve) => { complete = resolve }))
    const controller = buildController()
    controller.connect()
    await vi.advanceTimersByTimeAsync(3000)
    expect(fetch).toHaveBeenCalledTimes(1)
    controller.disconnect()
    controller.element.remove()
    complete({ ok: true, text: async () => "late" })
    await Promise.resolve()
    expect(globalThis.Turbo.renderStreamMessage).not.toHaveBeenCalled()
  })
})
