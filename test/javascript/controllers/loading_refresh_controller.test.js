import { buildControllerFixture } from "../support/controller_fixture"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import LoadingRefreshController from "controllers/loading_refresh_controller"

beforeEach(() => {
  vi.useFakeTimers()
  window.Turbo = { visit: vi.fn() }
})

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ""
  delete window.Turbo
})

function connected() {
  const controller = buildControllerFixture(LoadingRefreshController, {
    values: { intervalMs: 5000 }
  })
  controller.connect()
  return controller
}

it("reloads the page in place at each interval", () => {
  connected()
  vi.advanceTimersByTime(10000)
  expect(window.Turbo.visit).toHaveBeenCalledTimes(2)
  expect(window.Turbo.visit).toHaveBeenCalledWith(window.location.href, { action: "replace" })
})

it("leaves the page alone while a dialog is open", () => {
  document.body.innerHTML = '<div class="modal show"></div>'
  connected()
  vi.advanceTimersByTime(5000)
  expect(window.Turbo.visit).not.toHaveBeenCalled()
})

it("stops reloading once the user sets off somewhere, so as not to cancel that", () => {
  const controller = connected()
  controller.stop()
  vi.advanceTimersByTime(20000)
  expect(window.Turbo.visit).not.toHaveBeenCalled()
})

it("stops reloading when it disconnects", () => {
  const controller = connected()
  controller.disconnect()
  vi.advanceTimersByTime(20000)
  expect(window.Turbo.visit).not.toHaveBeenCalled()
})
