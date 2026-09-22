import { describe, expect, it } from "vitest"
import AddQueryController from "controllers/add_query_controller"

function controllerFor({ canAddQueriesValue = true, text = "" } = {}) {
  const element = document.createElement("form")
  element.innerHTML = `
    <input data-add-query-target="input">
    <input data-add-query-target="submit" type="submit">
    <i data-add-query-target="spinner"></i>
  `
  const controller = new AddQueryController(element)
  controller.element = element
  controller.inputTarget = element.querySelector('[data-add-query-target="input"]')
  controller.submitTarget = element.querySelector('[data-add-query-target="submit"]')
  controller.spinnerTarget = element.querySelector('[data-add-query-target="spinner"]')
  Object.defineProperty(controller, "canAddQueriesValue", { configurable: true, value: canAddQueriesValue })
  Object.defineProperty(controller, "placeholderValue", { configurable: true, value: "Add a query to this case" })
  controller.inputTarget.value = text
  return { controller, element }
}

describe("add_query_controller", () => {
  it("parses semicolon-separated input and dispatches the query texts", () => {
    const { controller, element } = controllerFor({ text: " first; second ;; " })
    const submissions = []
    element.addEventListener("add-query:submit", event => submissions.push(event.detail.queryTexts))

    controller.submit({ preventDefault() {} })

    expect(submissions).toEqual([["first", "second"]])
    expect(controller.inputTarget.value).toBe("")
    expect(controller.submitTarget.disabled).toBe(true)
  })

  it("renders disabled static-engine state and multi-query label", () => {
    const { controller } = controllerFor({ canAddQueriesValue: false, text: "one;two" })

    controller.render()

    expect(controller.submitTarget.disabled).toBe(true)
    expect(controller.submitTarget.value).toBe("Add queries")
    expect(controller.inputTarget.placeholder).toBe("Add a query to this case")
  })

  it("enables the submit and updates its label as text is typed", () => {
    const { controller } = controllerFor()

    controller.inputTarget.value = "one;two"
    controller.input()

    expect(controller.submitTarget.disabled).toBe(false)
    expect(controller.submitTarget.value).toBe("Add queries")
  })

  it("converts pasted newlines to semicolons", () => {
    const { controller } = controllerFor()
    controller.connect()
    const event = new Event("paste", { cancelable: true })
    Object.defineProperty(event, "clipboardData", {
      value: { getData: () => "one\ntwo" }
    })
    controller.inputTarget.dispatchEvent(event)

    expect(controller.inputTarget.value).toBe("one;two")
    expect(event.defaultPrevented).toBe(true)
    controller.disconnect()
  })

  it("stops loading when the Angular mutation bridge completes", () => {
    const { controller } = controllerFor({ text: "query" })
    controller.loading = true
    controller.complete({ detail: { success: false } })

    expect(controller.loading).toBe(false)
    expect(controller.spinnerTarget.classList.contains("d-none")).toBe(true)
  })
})
