import { describe, expect, it } from "vitest"
import CaseBookSynchronizationController from "controllers/case_book_synchronization_controller"

function buildController(linked) {
  const controller = Object.create(CaseBookSynchronizationController.prototype)
  controller.linkTheCaseTarget = { checked: linked }
  controller.synchronizationOptionTargets = [ { disabled: false }, { disabled: false } ]
  return controller
}

describe("CaseBookSynchronizationController", () => {
  it("disables directional synchronization options when the case is unlinked", () => {
    const controller = buildController(false)

    controller.toggleOptions()

    expect(controller.synchronizationOptionTargets).toEqual([ { disabled: true }, { disabled: true } ])
  })

  it("enables directional synchronization options when the case is linked", () => {
    const controller = buildController(true)

    controller.toggleOptions()

    expect(controller.synchronizationOptionTargets).toEqual([ { disabled: false }, { disabled: false } ])
  })
})
