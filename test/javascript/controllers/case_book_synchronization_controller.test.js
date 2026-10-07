import { describe, expect, it } from "vitest"
import CaseBookSynchronizationController from "controllers/case_book_synchronization_controller"
import { buildControllerFixture } from "../support/controller_fixture"

describe("case book synchronization", () => {
  it("disables synchronization without losing choices and restores them on relinking", () => {
    const link = { checked: false }
    const options = [{ name: "pairs", checked: true }, { name: "judgements", checked: false }]
    const fallbacks = [{ name: "pairs", value: "0" }, { name: "judgements", value: "0" }]
    const controller = buildControllerFixture(CaseBookSynchronizationController, {
      targets: { linkTheCase: link, synchronizationOption: options, synchronizationFallback: fallbacks }
    })
    controller.connect()
    expect(options.map((option) => option.disabled)).toEqual([true, true])
    expect(options.map((option) => option.checked)).toEqual([true, false])
    expect(fallbacks.map((field) => field.value)).toEqual(["1", "0"])
    link.checked = true
    controller.toggleOptions()
    expect(options.map((option) => option.disabled)).toEqual([false, false])
    expect(options.map((option) => option.checked)).toEqual([true, false])
    expect(fallbacks.map((field) => field.value)).toEqual(["0", "0"])
    link.checked = false
    controller.connect()
    expect(options.map((option) => option.disabled)).toEqual([true, true])
  })

  it("submits retained choices while disabled and unchecked values after relinking", () => {
    const form = document.createElement("form")
    form.innerHTML = `
      <input type="checkbox" name="link" checked>
      <input type="hidden" name="pairs" value="0">
      <input type="checkbox" name="pairs" value="1" checked>
      <input type="hidden" name="judgements" value="0">
      <input type="checkbox" name="judgements" value="1">
    `
    const link = form.querySelector('[name="link"]')
    const options = [...form.querySelectorAll('input[type="checkbox"]')].slice(1)
    const fallbacks = [...form.querySelectorAll('input[type="hidden"]')]
    const controller = buildControllerFixture(CaseBookSynchronizationController, {
      targets: { linkTheCase: link, synchronizationOption: options, synchronizationFallback: fallbacks }
    })
    controller.connect()
    link.checked = false
    controller.toggleOptions()
    let submitted = new FormData(form)
    expect(submitted.getAll("pairs")).toEqual(["1"])
    expect(submitted.getAll("judgements")).toEqual(["0"])

    controller.connect()
    link.checked = true
    controller.toggleOptions()
    options[0].checked = false
    options[1].checked = true
    submitted = new FormData(form)
    expect(submitted.getAll("pairs")).toEqual(["0"])
    expect(submitted.getAll("judgements")).toEqual(["0", "1"])

    link.checked = false
    controller.toggleOptions()
    submitted = new FormData(form)
    expect(submitted.getAll("pairs")).toEqual(["0"])
    expect(submitted.getAll("judgements")).toEqual(["1"])
  })
})
