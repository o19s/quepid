import { buildControllerFixture } from "../support/controller_fixture"
import { expect, it, vi } from "vitest"
import ConfirmDeleteController from "controllers/confirm_delete_controller"

it("passes the trigger's Stimulus values to the shared dialog", () => {
  const controller = buildControllerFixture(ConfirmDeleteController, {
    values: {
      url: "/cases/5",
      method: "patch",
      message: "Archive this case?"
    },
    outlets: {
      confirmDeleteDialog: { open: vi.fn() }
    }
  })
  const event = { preventDefault: vi.fn() }

  controller.open(event)

  expect(event.preventDefault).toHaveBeenCalled()
  expect(controller.confirmDeleteDialogOutlet.open).toHaveBeenCalledWith({
    url: "/cases/5", method: "patch", message: "Archive this case?"
  })
})
