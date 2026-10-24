import { expect, it } from "vitest"
import ScoreSelectionController from "controllers/score_selection_controller"
import { buildControllerFixture } from "../support/controller_fixture"

it("restores selection state and synchronizes both individual and all selections", () => {
  const rows = [document.createElement("input"), document.createElement("input")]
  rows[0].checked = true
  const controller = buildControllerFixture(ScoreSelectionController, {
    targets: { all: document.createElement("input"), score: rows, delete: document.createElement("button") }
  })
  controller.connect()
  expect(controller.deleteTarget.disabled).toBe(false)
  expect(controller.allTarget.checked).toBe(false)
  controller.allTarget.checked = true
  controller.toggleAll()
  expect(rows.every(row => row.checked)).toBe(true)
  controller.allTarget.checked = false
  controller.toggleAll()
  expect(controller.deleteTarget.disabled).toBe(true)
})
