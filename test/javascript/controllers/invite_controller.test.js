import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("utils/clipboard", () => ({
  copyText: vi.fn()
}))

import InviteController from "controllers/invite_controller"
import { copyText } from "utils/clipboard"

function buildController(link = "https://example.com/invite/abc") {
  const controller = Object.create(InviteController.prototype)
  controller.linkValue = link
  return controller
}

function clickEvent(button) {
  return { preventDefault: vi.fn(), currentTarget: button }
}

describe("InviteController", () => {
  let alertMock

  beforeEach(() => {
    vi.mocked(copyText).mockReset()
    alertMock = vi.fn()
    vi.stubGlobal("alert", alertMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it("copies the invite link and flashes Copied on the button", async () => {
    vi.useFakeTimers()
    vi.mocked(copyText).mockResolvedValue()
    const button = document.createElement("button")
    button.innerHTML = "📋"
    const controller = buildController()

    controller.copy(clickEvent(button))
    await Promise.resolve()

    expect(copyText).toHaveBeenCalledWith("https://example.com/invite/abc")
    expect(button.innerHTML).toBe("Copied")

    vi.advanceTimersByTime(1500)
    expect(button.innerHTML).toBe("📋")
  })

  it("shows on the button, not an alert, when no invite link is available", () => {
    vi.useFakeTimers()
    const controller = buildController("")
    const button = document.createElement("button")
    button.innerHTML = "📋"

    controller.copy(clickEvent(button))

    expect(copyText).not.toHaveBeenCalled()
    expect(alertMock).not.toHaveBeenCalled()
    expect(button.textContent).toBe("No invite link")
    vi.advanceTimersByTime(1500)
    expect(button.innerHTML).toBe("📋")
  })

  it("shows on the button, not an alert, when copy fails", async () => {
    vi.useFakeTimers()
    vi.mocked(copyText).mockRejectedValue(new Error("nope"))
    const button = document.createElement("button")
    button.innerHTML = "📋"
    const controller = buildController()

    controller.copy(clickEvent(button))
    await vi.advanceTimersByTimeAsync(0)

    expect(alertMock).not.toHaveBeenCalled()
    expect(button.textContent).toBe("Copy failed")
    vi.advanceTimersByTime(1500)
    expect(button.innerHTML).toBe("📋")
  })

  it("restores the original label after repeated clicks", async () => {
    vi.useFakeTimers()
    vi.mocked(copyText).mockResolvedValue()
    const button = document.createElement("button")
    button.innerHTML = "📋"
    const controller = buildController()

    controller.copy(clickEvent(button))
    await vi.advanceTimersByTimeAsync(500)
    controller.copy(clickEvent(button))
    await vi.advanceTimersByTimeAsync(0)
    expect(button.textContent).toBe("Copied")

    vi.advanceTimersByTime(1500)
    expect(button.innerHTML).toBe("📋")
  })
})