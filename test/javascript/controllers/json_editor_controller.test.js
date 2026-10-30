import { buildControllerFixture } from "../support/controller_fixture"
import { expect, it, vi } from "vitest"
import { getJson } from "api/json"
vi.mock("api/json", () => ({ getJson: vi.fn() }))
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
    values: { original: '{"original":true}', originalName: "proposed", newName: "wands" }
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

it("keeps the endpoint's own index name fixed, and lets a new index be named", () => {
  const { controller, name } = build()
  name.value = "proposed"
  controller.choose({ target: { value: "true" } })
  expect(name.readOnly).toBe(false)
  expect(name.value).toBe("wands")
  name.value = "mine"
  controller.choose({ target: { value: "false" } })
  expect(name.readOnly).toBe(true)
  expect(name.value).toBe("proposed")
})

it("shows the button for a new index only, and says what the server answered about the name", async () => {
  const availability = document.createElement("div")
  const availabilityButton = document.createElement("button")
  const name = document.createElement("input")
  name.value = "wands"
  const controller = buildControllerFixture(JsonEditorController, {
    targets: {
      input: document.createElement("textarea"),
      name,
      status: document.createElement("span"),
      availability,
      availabilityButton
    },
    values: {
      originalName: "haystack",
      newName: "wands",
      availabilityUrl: "/dataset_cases/1/index/availability?search_endpoint_id=2"
    }
  })
  controller.choose({ target: { value: "false" } })
  expect(availabilityButton.hidden).toBe(true)
  controller.choose({ target: { value: "true" } })
  expect(availabilityButton.hidden).toBe(false)

  getJson.mockResolvedValue({ status: "taken", message: "wands is already there." })
  await controller.checkAvailability()
  expect(getJson.mock.calls[0][0]).toContain("index_name=wands")
  expect(availability.textContent).toBe("wands is already there.")
  expect(availability.classList.contains("text-danger")).toBe(true)
  controller.clearAvailability()
  expect(availability.textContent).toBe("")
})

it("asks the service itself from the browser when the endpoint is not proxied", async () => {
  const availability = document.createElement("div")
  const name = document.createElement("input")
  name.value = "wands"
  const controller = buildControllerFixture(JsonEditorController, {
    targets: {
      input: document.createElement("textarea"),
      name,
      status: document.createElement("span"),
      availability
    },
    values: { probe: { origin: "http://localhost:9200", engine: "es", headers: { "X-Key": "1" } } }
  })
  globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 })
  await controller.checkAvailability()
  expect(globalThis.fetch.mock.calls[0][0]).toBe("http://localhost:9200/wands")
  expect(globalThis.fetch.mock.calls[0][1].headers).toEqual({ "X-Key": "1" })
  expect(availability.textContent).toBe("wands is free.")

  globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
  await controller.checkAvailability()
  expect(availability.textContent).toMatch(/could not reach http:\/\/localhost:9200/)
})
