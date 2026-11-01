import { buildControllerFixture } from "../support/controller_fixture"
import { expect, it } from "vitest"
import InitiateIndexingController from "controllers/initiate_indexing_controller"

function build({ withForm = true } = {}) {
  const form = document.createElement("form")
  form.action = "http://localhost/#"
  const caseName = document.createElement("strong")
  caseName.textContent = "this case"
  const controller = buildControllerFixture(InitiateIndexingController, {
    targets: { form: withForm ? form : null, caseName }
  })
  return { controller, form, caseName }
}

function button(url, name) {
  const element = document.createElement("button")
  element.dataset.url = url
  element.dataset.caseName = name
  return element
}

it("points the form at the case of the button that opened the dialog and names it", () => {
  const { controller, form, caseName } = build()
  controller.fill({ relatedTarget: button("/dataset_cases/7/endpoint", "IMDb movie searches") })
  expect(form.getAttribute("action")).toBe("/dataset_cases/7/endpoint")
  expect(caseName.textContent).toBe("IMDb movie searches")
})

it("uses the latest button each time it opens", () => {
  const { controller, form, caseName } = build()
  controller.fill({ relatedTarget: button("/dataset_cases/7/endpoint", "First") })
  controller.fill({ relatedTarget: button("/dataset_cases/9/endpoint", "Second") })
  expect(form.getAttribute("action")).toBe("/dataset_cases/9/endpoint")
  expect(caseName.textContent).toBe("Second")
})

it("does nothing when the dialog was opened without a button", () => {
  const { controller, form, caseName } = build()
  controller.fill({ relatedTarget: null })
  expect(form.action).toBe("http://localhost/#")
  expect(caseName.textContent).toBe("this case")
})

it("still names the case when the dialog has no form because there are no endpoints", () => {
  const { controller, caseName } = build({ withForm: false })
  controller.fill({ relatedTarget: button("/dataset_cases/7/endpoint", "No endpoints") })
  expect(caseName.textContent).toBe("No endpoints")
})
