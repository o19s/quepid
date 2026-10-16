import { buildControllerFixture } from "../support/controller_fixture"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("utils/clipboard", () => ({ copyText: vi.fn() }))

import { copyText } from "utils/clipboard"
import ClipboardController from "controllers/clipboard_controller"

function buildController({ values = {}, targets = {} } = {}) {
  return buildControllerFixture(ClipboardController, {
    values: { text: "analytics/tries_visualization/abc", feedbackMs: 2000, ...values },
    targets,
    overrides: { dispatch: vi.fn() }
  })
}

function buttonWith(html) {
  const button = document.createElement("button")
  button.innerHTML = html
  return button
}

describe("ClipboardController", () => {
  beforeEach(() => {
    vi.mocked(copyText).mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it("copies its text value", () => {
    copyText.mockResolvedValue(undefined)

    buildController().copy()

    expect(copyText).toHaveBeenCalledWith("analytics/tries_visualization/abc")
  })

  it("logs a rejected copy instead of leaving it unhandled", async () => {
    const error = new Error("denied")
    copyText.mockRejectedValue(error)
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    buildController().copy()

    await vi.waitFor(() => expect(consoleError).toHaveBeenCalledWith(error))
  })

  it("leaves the button alone when no feedback labels are configured", async () => {
    copyText.mockResolvedValue(undefined)
    const button = buttonWith('<i class="bi bi-clipboard"></i>')
    const controller = buildController()

    controller.copy({ currentTarget: button })
    await Promise.resolve()

    expect(controller.dispatch).toHaveBeenCalledWith("copied")
    expect(button.innerHTML).toBe('<i class="bi bi-clipboard"></i>')
  })

  it("flashes a text-only success label, then restores the button", async () => {
    vi.useFakeTimers()
    copyText.mockResolvedValue(undefined)
    const button = buttonWith("📋")
    const controller = buildController({ values: { successLabel: "Copied", feedbackMs: 1500 } })

    controller.copy({ currentTarget: button })
    await Promise.resolve()

    expect(button.innerHTML).toBe("Copied")
    vi.advanceTimersByTime(1500)
    expect(button.innerHTML).toBe("📋")
  })

  it("flashes the failure label and reports the error", async () => {
    vi.useFakeTimers()
    const error = new Error("nope")
    copyText.mockRejectedValue(error)
    vi.spyOn(console, "error").mockImplementation(() => {})
    const button = buttonWith("📋")
    const controller = buildController({ values: { failureLabel: "Copy failed", feedbackMs: 1500 } })

    controller.copy({ currentTarget: button })
    await vi.advanceTimersByTimeAsync(0)

    expect(controller.dispatch).toHaveBeenCalledWith("failed", { detail: { error } })
    expect(button.textContent).toBe("Copy failed")
    vi.advanceTimersByTime(1500)
    expect(button.innerHTML).toBe("📋")
  })

  it("shows an icon before the label when one is configured", async () => {
    vi.useFakeTimers()
    copyText.mockResolvedValue(undefined)
    const original = '\n  <i class="bi bi-clipboard"></i> Copy\n'
    const button = buttonWith(original)
    const controller = buildController({ values: { successLabel: "Copied!", successIcon: "bi-clipboard-check" } })

    controller.copy({ currentTarget: button })
    await Promise.resolve()

    expect(button.innerHTML).toBe('<i class="bi bi-clipboard-check"></i> Copied!')
    vi.advanceTimersByTime(2000)
    expect(button.innerHTML).toBe(original)
  })

  it("restores the original label after repeated clicks", async () => {
    vi.useFakeTimers()
    copyText.mockResolvedValue(undefined)
    const button = buttonWith("📋")
    const controller = buildController({ values: { successLabel: "Copied", feedbackMs: 1500 } })

    controller.copy({ currentTarget: button })
    await vi.advanceTimersByTimeAsync(500)
    controller.copy({ currentTarget: button })
    await vi.advanceTimersByTimeAsync(0)
    expect(button.textContent).toBe("Copied")

    vi.advanceTimersByTime(1500)
    expect(button.innerHTML).toBe("📋")
  })

  it("cancels restoration on disconnect and keeps the original label on reconnect", () => {
    vi.useFakeTimers()
    const button = buttonWith('<i class="bi bi-clipboard"></i>')
    const controller = buildController({ values: { feedbackMs: 1500 } })

    controller.showFeedback(button, "", "Copied")
    controller.disconnect()
    vi.advanceTimersByTime(1500)
    expect(button.textContent).toBe("Copied")

    controller.showFeedback(button, "", "Copy failed")
    vi.advanceTimersByTime(1500)
    expect(button.innerHTML).toBe('<i class="bi bi-clipboard"></i>')
  })

  it("copies its source target's text instead of the text value", () => {
    copyText.mockResolvedValue(undefined)
    const source = document.createElement("pre")
    source.textContent = "<html>results</html>"

    buildController({ targets: { source } }).copy()

    expect(copyText).toHaveBeenCalledWith("<html>results</html>")
  })

  it("reports an empty source instead of copying", () => {
    const controller = buildController({ targets: { source: document.createElement("pre") } })

    controller.copy()

    expect(copyText).not.toHaveBeenCalled()
    expect(controller.dispatch).toHaveBeenCalledWith("empty")
  })
})
