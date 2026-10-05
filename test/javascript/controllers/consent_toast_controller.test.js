import { afterEach, expect, it, vi } from "vitest"
import Cookies from "js-cookie"
import ConsentToastController from "controllers/consent_toast_controller"
import { buildControllerFixture } from "../support/controller_fixture"

vi.mock("js-cookie", () => ({ default: { get: vi.fn(), set: vi.fn() } }))
afterEach(() => vi.restoreAllMocks())

it("skips an already accepted banner and disposes a displayed toast before caching", () => {
  const toast = { show: vi.fn(), hide: vi.fn(), dispose: vi.fn() }
  window.bootstrap = { Toast: class { constructor() { return toast } } }
  const controller = buildControllerFixture(ConsentToastController)
  Cookies.get.mockReturnValue("true")
  controller.connect()
  expect(toast.show).not.toHaveBeenCalled()
  Cookies.get.mockReturnValue(undefined)
  controller.connect()
  expect(toast.show).toHaveBeenCalledOnce()
  controller.accept()
  expect(Cookies.set).toHaveBeenCalledWith("cookie_eu_consented", true, expect.objectContaining({ expires: 365, path: "/" }))
  expect(toast.hide).toHaveBeenCalledOnce()
  controller.teardown()
  controller.disconnect()
  expect(toast.dispose).toHaveBeenCalledOnce()
})
