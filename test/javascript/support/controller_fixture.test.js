import { describe, expect, it, vi } from "vitest"
import { buildControllerFixture } from "./controller_fixture"

class ExampleController {
  connect() {}
  readTitle() { return this.titleTarget.textContent }
}

describe("buildControllerFixture", () => {
  it("keeps controller methods without invoking lifecycle hooks", () => {
    const connect = vi.spyOn(ExampleController.prototype, "connect")
    const title = document.createElement("h5")
    title.textContent = "Export case"
    const controller = buildControllerFixture(ExampleController, { targets: { title } })

    expect(controller).toBeInstanceOf(ExampleController)
    expect(controller.readTitle()).toBe("Export case")
    expect(controller.titleTargets).toEqual([title])
    expect(controller.hasTitleTarget).toBe(true)
    expect(connect).not.toHaveBeenCalled()
    connect.mockRestore()
  })

  it("handles repeated and absent targets", () => {
    const buttons = [document.createElement("button"), document.createElement("button")]
    const controller = buildControllerFixture(ExampleController, {
      targets: { button: buttons, alert: null, item: [] }
    })

    expect(controller.buttonTarget).toBe(buttons[0])
    expect(controller.buttonTargets).toBe(buttons)
    expect(controller.hasButtonTarget).toBe(true)
    expect(controller.alertTargets).toEqual([])
    expect(controller.alertTarget).toBeUndefined()
    expect(controller.hasAlertTarget).toBe(false)
    expect(controller.hasItemTarget).toBe(false)
  })

  it("preserves explicit false/zero values and applies overrides last", () => {
    const element = document.createElement("form")
    const controller = buildControllerFixture(ExampleController, {
      element,
      values: { enabled: false, count: 0 },
      overrides: { countValue: 3, hasEnabledValue: false }
    })

    expect(controller.element).toBe(element)
    expect(controller.enabledValue).toBe(false)
    expect(controller.hasEnabledValue).toBe(false)
    expect(controller.countValue).toBe(3)
    expect(controller.hasCountValue).toBe(true)
    expect(buildControllerFixture(ExampleController).element.tagName).toBe("DIV")
  })
})
