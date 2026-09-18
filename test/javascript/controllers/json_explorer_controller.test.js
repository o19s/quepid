import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import JsonExplorerController from "controllers/json_explorer_controller"

vi.mock("utils/json_explorer", () => ({
  renderJsonExplorer: vi.fn()
}))

import { renderJsonExplorer } from "utils/json_explorer"

function buildController(element, json) {
  const controller = Object.create(JsonExplorerController.prototype)
  controller.element = element
  controller.jsonValue = json
  return controller
}

describe("JsonExplorerController", () => {
  let element

  beforeEach(() => {
    element = document.createElement("div")
    document.body.appendChild(element)
    vi.clearAllMocks()
  })

  afterEach(() => {
    element.remove()
  })

  it("renders into its own element on connect", () => {
    const controller = buildController(element, '{"a":1}')
    JsonExplorerController.prototype.connect.call(controller)

    expect(renderJsonExplorer).toHaveBeenCalledWith(element, '{"a":1}', { collapsed: false })
  })

  it("re-renders when jsonValue changes while connected", () => {
    const controller = buildController(element, '{"a":1}')
    JsonExplorerController.prototype.jsonValueChanged.call(controller)

    expect(renderJsonExplorer).toHaveBeenCalledWith(element, '{"a":1}', { collapsed: false })
  })

  it("does not render for a change on a detached element", () => {
    element.remove()
    const controller = buildController(element, '{"a":1}')
    JsonExplorerController.prototype.jsonValueChanged.call(controller)

    expect(renderJsonExplorer).not.toHaveBeenCalled()
  })
})
