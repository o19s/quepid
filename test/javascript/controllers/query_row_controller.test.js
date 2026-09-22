import { beforeEach, describe, expect, it } from "vitest"
import QueryRowController from "controllers/query_row_controller"

describe("QueryRowController", () => {
  let controller

  beforeEach(() => {
    document.body.innerHTML = `
      <div>
        <span data-query-row-target="query"></span>
        <span data-query-row-target="text"></span>
        <span data-query-row-target="resultCount"></span>
        <small data-query-row-target="resultLabel"></small>
        <span data-query-row-target="querqy"></span>
      </div>
    `
    controller = Object.create(QueryRowController.prototype)
    controller.element = document.body.firstElementChild
    controller.hasTextTarget = true
    controller.hasQueryTarget = true
    controller.hasResultCountTarget = true
    controller.hasResultLabelTarget = true
    controller.hasQuerqyTarget = true
    controller.hasStateValue = true
    controller.queryTarget = controller.element.querySelector('[data-query-row-target="query"]')
    controller.textTarget = controller.element.querySelector('[data-query-row-target="text"]')
    controller.resultCountTarget = controller.element.querySelector('[data-query-row-target="resultCount"]')
    controller.resultLabelTarget = controller.element.querySelector('[data-query-row-target="resultLabel"]')
    controller.querqyTarget = controller.element.querySelector('[data-query-row-target="querqy"]')
    controller.queryTextValue = "Star Wars"
    controller.numFoundValue = 1
    controller.querqyTriggeredValue = true
    controller.informationNeedValue = "Find space movies"
    controller.stateValue = "searching"
  })

  it("renders read-only row values", () => {
    controller.render()

    expect(controller.textTarget.textContent).toBe("Star Wars\u00a0")
    expect(controller.queryTarget.getAttribute("data-bs-tooltip-title-value")).toBe("Info Need: Find space movies")
    expect(controller.resultCountTarget.getAttribute("data-count-up-number-value")).toBe("1")
    expect(controller.resultLabelTarget.textContent).toBe("Result")
    expect(controller.querqyTarget.classList.contains("d-none")).toBe(false)
    expect(controller.element.classList.contains("queryHeader_searching")).toBe(true)
  })

  it("uses plural result copy and hides the Querqy marker when inactive", () => {
    controller.numFoundValue = 2
    controller.querqyTriggeredValue = false
    controller.render()
    controller.stateValue = "error"
    controller.stateValueChanged("error", "searching")
    controller.render()

    expect(controller.resultLabelTarget.textContent).toBe("Results")
    expect(controller.querqyTarget.classList.contains("d-none")).toBe(true)
    expect(controller.element.classList.contains("queryHeader_searching")).toBe(false)
    expect(controller.element.classList.contains("queryHeader_error")).toBe(true)
  })
})
