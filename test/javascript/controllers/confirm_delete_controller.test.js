import { expect, it, vi } from "vitest"
import ConfirmDeleteController from "controllers/confirm_delete_controller"

it("passes the trigger's Stimulus values to the shared dialog", () => {
  const controller = Object.create(ConfirmDeleteController.prototype)
  controller.urlValue = "/cases/5"
  controller.methodValue = "patch"
  controller.messageValue = "Archive this case?"
  controller.confirmDeleteDialogOutlet = { open: vi.fn() }
  const event = { preventDefault: vi.fn() }

  controller.open(event)

  expect(event.preventDefault).toHaveBeenCalled()
  expect(controller.confirmDeleteDialogOutlet.open).toHaveBeenCalledWith({
    url: "/cases/5", method: "patch", message: "Archive this case?"
  })
})
