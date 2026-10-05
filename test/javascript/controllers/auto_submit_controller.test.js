import { expect, it, vi } from "vitest"
import AutoSubmitController from "controllers/auto_submit_controller"

it("requests a real submit event so Turbo and validation can handle filters", () => {
  const form = { requestSubmit: vi.fn() }
  const controller = Object.create(AutoSubmitController.prototype)
  controller.submit({ target: { form } })
  expect(form.requestSubmit).toHaveBeenCalledOnce()
  controller.submit({ target: { form: null } })
})
