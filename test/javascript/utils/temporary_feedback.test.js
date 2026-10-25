import { afterEach, describe, expect, it, vi } from "vitest"
import { createTemporaryFeedback } from "utils/temporary_feedback"

afterEach(() => vi.useRealTimers())

describe("temporary feedback", () => {
  it("renders immediately and restores only after the latest display's delay", () => {
    vi.useFakeTimers()
    const feedback = createTemporaryFeedback(1500)
    const render = vi.fn()
    const oldRestore = vi.fn()
    const restore = vi.fn()

    feedback.show(render, oldRestore)
    expect(render).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(1000)
    feedback.show(render, restore)
    vi.advanceTimersByTime(1499)
    expect(oldRestore).not.toHaveBeenCalled()
    expect(restore).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(restore).toHaveBeenCalledOnce()
  })

  it("keeps independent feedback windows and cancels only its own restoration", () => {
    vi.useFakeTimers()
    const invite = createTemporaryFeedback(1500)
    const explain = createTemporaryFeedback(2000)
    const inviteRestore = vi.fn()
    const explainRestore = vi.fn()
    invite.show(() => {}, inviteRestore)
    explain.show(() => {}, explainRestore)
    invite.cancel()
    vi.advanceTimersByTime(2000)
    expect(inviteRestore).not.toHaveBeenCalled()
    expect(explainRestore).toHaveBeenCalledOnce()

    invite.show(() => {}, inviteRestore)
    vi.advanceTimersByTime(1500)
    expect(inviteRestore).toHaveBeenCalledOnce()
  })
})
