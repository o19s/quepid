import { expect, it, vi } from "vitest"
import CodemirrorController from "controllers/codemirror_controller"
import { fromTextArea } from "modules/editor"
import { buildControllerFixture } from "../support/controller_fixture"

vi.mock("modules/editor", () => ({ fromTextArea: vi.fn() }))

it("initializes from server attributes and tears down once across cache and disconnect", () => {
  const textarea = document.createElement("textarea")
  Object.assign(textarea.dataset, { codemirrorMode: "json", codemirrorHeight: "100", codemirrorReadonly: "true" })
  const editor = { destroy: vi.fn() }
  fromTextArea.mockReturnValue(editor)
  const controller = buildControllerFixture(CodemirrorController, { element: textarea })
  controller.connect()
  expect(fromTextArea).toHaveBeenCalledWith(textarea, { mode: "json", height: 100, width: undefined, readOnly: true })
  controller.teardown()
  controller.disconnect()
  expect(editor.destroy).toHaveBeenCalledTimes(1)
})
