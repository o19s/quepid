import { buildControllerFixture } from "../support/controller_fixture"
import { expect, it, vi } from "vitest"
import DatasetCaseFormController from "controllers/dataset_case_form_controller"

const show = vi.fn()
vi.mock("utils/bs_modal", () => ({ getOrCreateBsModal: () => ({ show }) }))

function build({ open = false } = {}) {
  const dataset = document.createElement("select")
  dataset.innerHTML = `
    <option value="haystack" data-default-name="Haystack Rating Party">Haystack</option>
    <option value="imdb" data-default-name="IMDb movie searches">IMDb</option>`
  const name = document.createElement("input")
  const groups = ["haystack", "imdb"].map((key) => {
    const group = document.createElement("div")
    group.dataset.datasetKey = key
    group.append(document.createElement("select"), document.createElement("input"))
    return group
  })
  const controller = buildControllerFixture(DatasetCaseFormController, {
    targets: { dataset, name, scorerGroup: groups },
    values: { open }
  })
  return { controller, dataset, name, groups }
}

it("shows only the scorer list and sample size of the selected dataset and disables the others so they are not submitted", () => {
  const { controller, groups } = build()
  controller.connect()
  expect(groups.map((group) => group.hidden)).toEqual([false, true])
  expect(groups.map((group) => group.querySelector("select").disabled)).toEqual([false, true])
  expect(groups.map((group) => group.querySelector("input").disabled)).toEqual([false, true])
})

it("sets the case name and switches the scorer list when the dataset changes", () => {
  const { controller, dataset, name, groups } = build()
  dataset.value = "imdb"
  controller.change()
  expect(name.value).toBe("IMDb movie searches")
  expect(groups.map((group) => group.hidden)).toEqual([true, false])
  expect(groups.map((group) => group.querySelector("select").disabled)).toEqual([true, false])
  expect(groups.map((group) => group.querySelector("input").disabled)).toEqual([true, false])
})

it("opens its dialog on connect only when asked to", () => {
  const modal = document.createElement("div")
  modal.className = "modal"
  const closed = build()
  modal.append(closed.controller.element)
  closed.controller.connect()
  expect(show).not.toHaveBeenCalled()

  const opened = build({ open: true })
  modal.append(opened.controller.element)
  opened.controller.connect()
  expect(show).toHaveBeenCalledOnce()
})

it("drops ?dataset= from the address once it has opened, so a refresh does not reopen the dialog", () => {
  window.history.replaceState(null, "", "/dataset_cases?dataset=imdb&other=1")
  const modal = document.createElement("div")
  modal.className = "modal"
  const opened = build({ open: true })
  modal.append(opened.controller.element)
  opened.controller.connect()
  expect(window.location.search).toBe("?other=1")
})
