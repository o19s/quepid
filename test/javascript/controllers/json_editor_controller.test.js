import { buildControllerFixture } from "../support/controller_fixture"
import { expect, it } from "vitest"
import JsonEditorController from "controllers/json_editor_controller"

function build(text = '{"a":1}') {
  const input = document.createElement("textarea")
  input.value = text
  const name = document.createElement("input")
  name.value = "my-index"
  const status = document.createElement("span")
  const submit = document.createElement("button")
  const controller = buildControllerFixture(JsonEditorController, {
    targets: { input, name, status, submit },
    values: { original: '{"original":true}', originalName: "proposed" }
  })
  return { controller, input, name, status, submit }
}

it("says the JSON is valid and lets the form be sent", () => {
  const { controller, status, submit } = build()
  controller.check()
  expect(status.textContent).toBe("Valid JSON")
  expect(status.classList.contains("text-success")).toBe(true)
  expect(submit.disabled).toBe(false)
})

it("says why it is not valid and keeps the form from being sent", () => {
  const { controller, input, status, submit } = build()
  input.value = "{oops"
  controller.check()
  expect(status.textContent).toMatch(/^Not valid JSON: /)
  expect(status.classList.contains("text-danger")).toBe(true)
  expect(submit.disabled).toBe(true)
})

it("only takes an object, not a list or a bare value", () => {
  const { controller, input, submit } = build()
  const disabled = ["[1,2]", "42", "null", '"text"'].map((text) => {
    input.value = text
    controller.check()
    return submit.disabled
  })
  expect(disabled).toEqual([true, true, true, true])
})

it("tidies valid JSON, and leaves invalid text as it is", () => {
  const { controller, input } = build('{"a":{"b":1}}')
  controller.format()
  expect(input.value).toBe('{\n  "a": {\n    "b": 1\n  }\n}')
  input.value = "{oops"
  controller.format()
  expect(input.value).toBe("{oops")
})

it("puts the proposed definition and name back", () => {
  const { controller, input, name, submit } = build("{oops")
  controller.check()
  expect(submit.disabled).toBe(true)
  controller.reset()
  expect(input.value).toBe('{"original":true}')
  expect(name.value).toBe("proposed")
  expect(submit.disabled).toBe(false)
})
