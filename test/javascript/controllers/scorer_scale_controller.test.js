import { describe, expect, it } from "vitest"
import ScorerScaleController from "controllers/scorer_scale_controller"

function mount() {
  const element = document.createElement("form")
  element.innerHTML = `
    <input type="radio" name="scale_preset" value="binary">
    <input type="radio" name="scale_preset" value="graded">
    <input type="radio" name="scale_preset" value="custom">
    <input type="text" data-target="list">
    <div data-target="labels"></div>`
  const controller = Object.create(ScorerScaleController.prototype)
  controller.element = element
  controller.hasScaleListTarget = true
  controller.scaleListTarget = element.querySelector('[data-target="list"]')
  controller.hasScaleLabelsTarget = true
  controller.scaleLabelsTarget = element.querySelector('[data-target="labels"]')
  controller.connect()
  return { controller, element }
}

const choose = (element, value) => {
  const radio = element.querySelector(`input[value="${value}"]`)
  radio.checked = true
  radio.dispatchEvent(new Event("change", { bubbles: true }))
}
const labelInputs = controller => [...controller.scaleLabelsTarget.querySelectorAll("input")].map(i => i.name)

describe("ScorerScaleController", () => {
  it("fills a binary scale and builds a label input per value", () => {
    const { controller, element } = mount()
    choose(element, "binary")
    expect(controller.scaleListTarget.value).toBe("0,1")
    expect(labelInputs(controller)).toEqual(["scorer[scale_with_labels][0]", "scorer[scale_with_labels][1]"])
  })

  it("fills a graded scale", () => {
    const { controller, element } = mount()
    choose(element, "graded")
    expect(controller.scaleListTarget.value).toBe("0,1,2,3")
    expect(labelInputs(controller)).toHaveLength(4)
  })

  it("clears the field and shows a placeholder for a custom scale", () => {
    const { controller, element } = mount()
    choose(element, "graded")
    choose(element, "custom")
    expect(controller.scaleListTarget.value).toBe("")
    expect(controller.scaleListTarget.placeholder).toMatch(/comma separated/i)
  })

  it("dispatches a change event on the scale list when a preset is chosen", () => {
    const { controller, element } = mount()
    let changed = 0
    controller.scaleListTarget.addEventListener("change", () => changed++)
    choose(element, "binary")
    expect(changed).toBe(1)
  })

  it("rebuilds labels as the scale list is typed, ignoring blanks and stray commas", () => {
    const { controller } = mount()
    controller.scaleListTarget.value = " 0, 5 ,,10 "
    controller.scaleListTarget.dispatchEvent(new Event("input"))
    expect(labelInputs(controller)).toEqual([
      "scorer[scale_with_labels][0]",
      "scorer[scale_with_labels][5]",
      "scorer[scale_with_labels][10]"
    ])
  })

  it("leaves labels untouched when the scale list is emptied", () => {
    const { controller } = mount()
    controller.scaleListTarget.value = "0,1"
    controller.scaleListTarget.dispatchEvent(new Event("input"))
    controller.scaleListTarget.value = "   "
    controller.scaleListTarget.dispatchEvent(new Event("input"))
    expect(labelInputs(controller)).toHaveLength(2)
  })

  it("does not throw when there is no labels target", () => {
    const { controller } = mount()
    controller.hasScaleLabelsTarget = false
    expect(() => controller.updateScaleLabels("0,1")).not.toThrow()
  })
})
