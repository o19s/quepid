import { afterEach, describe, expect, it, vi } from "vitest"
import JudgementRatingController from "controllers/judgement_rating_controller"
import { buildControllerFixture } from "../support/controller_fixture"

function fixture() {
  const form = document.createElement("form")
  const button = document.createElement("button")
  button.dataset.judgementRatingKeyParam = "a"
  const shortcut = document.createElement("span")
  shortcut.dataset.key = "a"
  const controller = buildControllerFixture(JudgementRatingController, {
    element: form,
    targets: { rating: document.createElement("input"), submit: button, button: [button], shortcut: [shortcut] }
  })
  controller.connect()
  return { controller, form, button, shortcut }
}

afterEach(() => vi.useRealTimers())

describe("judgement rating", () => {
  it("submits one rating and cancels pending submissions on disconnect", () => {
    vi.useFakeTimers()
    const { controller, form, shortcut } = fixture()
    form.requestSubmit = vi.fn()
    controller.rate({ params: { rating: 0, key: "a" } })
    controller.rate({ params: { rating: 1, key: "a" } })
    expect(controller.ratingTarget.value).toBe("0")
    expect(shortcut.style.fontWeight).toBe("bold")
    vi.advanceTimersByTime(100)
    expect(form.requestSubmit).toHaveBeenCalledTimes(1)
    controller.cancel()
    controller.rate({ params: { rating: 1, key: "a" } })
    controller.disconnect()
    vi.advanceTimersByTime(100)
    expect(form.requestSubmit).toHaveBeenCalledTimes(1)
  })

  it("ignores typing and modifier shortcuts and cancels delayed keys", () => {
    vi.useFakeTimers()
    const { controller, form, button } = fixture()
    form.requestSubmit = vi.fn()
    button.click = vi.fn()
    const target = document.createElement("div")
    controller.keydown({ key: "a", target, ctrlKey: true })
    controller.keydown({ key: "a", target: document.createElement("textarea") })
    vi.advanceTimersByTime(500)
    expect(button.click).not.toHaveBeenCalled()
    controller.keydown({ key: "A", target })
    controller.disconnect()
    vi.advanceTimersByTime(500)
    expect(button.click).not.toHaveBeenCalled()
    controller.connect()
    controller.keydown({ key: "A", target })
    vi.advanceTimersByTime(500)
    expect(button.click).toHaveBeenCalledTimes(1)
  })
})
