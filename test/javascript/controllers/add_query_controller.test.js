import { describe, expect, it, vi } from "vitest"
import AddQueryController from "controllers/add_query_controller"
import { buildControllerFixture } from "../support/controller_fixture"

let testCapabilities

vi.mock("utils/core_capability_access", () => ({ getCoreCapabilities: () => testCapabilities || {} }))

function controllerFor({ canAddQueriesValue = true, text = "" } = {}) {
  const element = document.createElement("form")
  element.innerHTML = `
    <input data-add-query-target="input">
    <input data-add-query-target="submit" type="submit">
    <i data-add-query-target="spinner"></i>
  `
  const controller = buildControllerFixture(AddQueryController, {
    element,
    targets: {
      input: element.querySelector('[data-add-query-target="input"]'),
      submit: element.querySelector('[data-add-query-target="submit"]'),
      spinner: element.querySelector('[data-add-query-target="spinner"]')
    },
    values: {
      canAddQueries: canAddQueriesValue,
      placeholder: "Add a query to this case"
    }
  })
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

  function pasteInto(controller, text) {
    const event = new Event("paste", { cancelable: true })
    Object.defineProperty(event, "clipboardData", {
      value: { getData: () => text }
    })
    controller.inputTarget.dispatchEvent(event)
    return event
  }

  it("keeps the typed query when text is pasted at the end", () => {
    const { controller } = controllerFor({ text: "a b c" })
    controller.connect()
    controller.inputTarget.setSelectionRange(5, 5)

    const event = pasteInto(controller, "one\ntwo")

    expect(controller.inputTarget.value).toBe("a b cone;two")
    expect(event.defaultPrevented).toBe(true)
    controller.disconnect()
  })

  it("replaces only the selected text with the pasted text", () => {
    const { controller } = controllerFor({ text: "first second third" })
    controller.connect()
    controller.inputTarget.setSelectionRange(6, 12)

    pasteInto(controller, "x\ny")

    expect(controller.inputTarget.value).toBe("first x;y third")
    controller.disconnect()
  })

  it("moves the cursor after the pasted text and updates the submit label", () => {
    const { controller } = controllerFor({ text: "ab" })
    controller.connect()
    controller.inputTarget.setSelectionRange(1, 1)

    pasteInto(controller, "x\ny")

    expect(controller.inputTarget.selectionStart).toBe(5)
    expect(controller.inputTarget.selectionEnd).toBe(5)
    expect(controller.submitTarget.value).toBe("Add queries")
    controller.disconnect()
  })

  it("refreshes capability state without clearing the typed query", () => {
    const { controller } = controllerFor({ text: "unfinished query" })
    testCapabilities = { queryCapabilities: {
      getListState: () => ({ canAddQueries: false, addQueryMessage: "Queries are unavailable" })
    } }
    try {
      controller.refreshQueryState()
      expect(controller.submitTarget.disabled).toBe(true)
      expect(controller.inputTarget.placeholder).toBe("Queries are unavailable")
      expect(controller.inputTarget.value).toBe("unfinished query")
    } finally {
      testCapabilities = undefined
    }
  })

  it("stops loading when the mutation bridge completes", () => {
    const { controller } = controllerFor({ text: "query" })
    controller.loading = true
    controller.complete({ detail: { success: false } })

    expect(controller.loading).toBe(false)
    expect(controller.spinnerTarget.classList.contains("d-none")).toBe(true)
  })
})
