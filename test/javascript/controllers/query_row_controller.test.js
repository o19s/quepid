import { beforeEach, describe, expect, it } from "vitest"
import QueryRowController from "controllers/query_row_controller"

describe("QueryRowController", () => {
  let controller

  beforeEach(() => {
    document.body.innerHTML = `
      <div>
        <span data-query-row-target="query"></span>
        <img data-query-row-target="image" />
        <span data-query-row-target="text"></span>
        <span data-query-row-target="resultCount"></span>
        <small data-query-row-target="resultLabel"></small>
        <span data-query-row-target="querqy"></span>
        <div data-query-row-target="header"></div>
        <i data-query-row-target="toggle"></i>
      </div>
    `
    controller = Object.create(QueryRowController.prototype)
    controller.element = document.body.firstElementChild
    controller.hasTextTarget = true
    controller.hasQueryTarget = true
    controller.hasImageTarget = true
    controller.hasResultCountTarget = true
    controller.hasResultLabelTarget = true
    controller.hasQuerqyTarget = true
    controller.hasHeaderTarget = true
    controller.hasToggleTarget = true
    controller.hasStateValue = true
    controller.queryTarget = controller.element.querySelector('[data-query-row-target="query"]')
    controller.imageTarget = controller.element.querySelector('[data-query-row-target="image"]')
    controller.textTarget = controller.element.querySelector('[data-query-row-target="text"]')
    controller.resultCountTarget = controller.element.querySelector('[data-query-row-target="resultCount"]')
    controller.resultLabelTarget = controller.element.querySelector('[data-query-row-target="resultLabel"]')
    controller.querqyTarget = controller.element.querySelector('[data-query-row-target="querqy"]')
    controller.headerTarget = controller.element.querySelector('[data-query-row-target="header"]')
    controller.toggleTarget = controller.element.querySelector('[data-query-row-target="toggle"]')
    controller.queryTextValue = "Star Wars"
    controller.queryIdValue = 42
    controller.rankValue = 3
    controller.numFoundValue = 1
    controller.querqyTriggeredValue = true
    controller.informationNeedValue = "Find space movies"
    controller.stateValue = "searching"
    controller.diffValue = true
    controller.toggledValue = true
    controller.sortingValue = false
  })

  it("renders read-only row values", () => {
    controller.render()

    expect(controller.element.id).toBe("query-Star Wars")
    expect(controller.element.getAttribute("rank")).toBe("3")
    expect(controller.textTarget.textContent).toBe("Star Wars\u00a0")
    expect(controller.imageTarget.classList.contains("d-none")).toBe(true)
    expect(controller.queryTarget.getAttribute("data-bs-tooltip-title-value")).toBe("Info Need: Find space movies")
    expect(controller.resultCountTarget.getAttribute("data-count-up-number-value")).toBe("1")
    expect(controller.resultLabelTarget.textContent).toBe("Result")
    expect(controller.querqyTarget.classList.contains("d-none")).toBe(false)
    expect(controller.element.classList.contains("queryHeader_searching")).toBe(true)
    expect(controller.element.querySelector('[data-query-row-target="header"]').classList.contains("diff-query-display")).toBe(true)
    expect(controller.element.querySelector('[data-query-row-target="toggle"]').classList.contains("bi-caret-up-fill")).toBe(true)
  })

  it("dispatches a toggle intent for an unsorted row", () => {
    controller.dispatch = (name, options) => {
      controller.dispatchName = name
      controller.dispatchOptions = options
    }

    controller.toggle({ preventDefault: () => {} })

    expect(controller.dispatchName).toBe("toggle")
    expect(controller.dispatchOptions.detail.queryId).toBe(42)
  })

  it("does not dispatch a toggle intent while sorting", () => {
    controller.sortingValue = true
    controller.dispatch = () => {
      throw new Error("sorting rows must not toggle")
    }

    controller.toggle({ preventDefault: () => {} })
  })

  it("uses plural result copy and hides the Querqy marker when inactive", () => {
    controller.numFoundValue = 2
    controller.querqyTriggeredValue = false
    controller.render()
    controller.stateValue = "error"
    controller.stateValueChanged("error", "searching")
    controller.diffValue = false
    controller.toggledValue = false
    controller.sortingValue = true
    controller.render()

    expect(controller.resultLabelTarget.textContent).toBe("Results")
    expect(controller.querqyTarget.classList.contains("d-none")).toBe(true)
    expect(controller.element.classList.contains("queryHeader_searching")).toBe(false)
    expect(controller.element.classList.contains("queryHeader_error")).toBe(true)
    expect(controller.element.querySelector('[data-query-row-target="header"]').classList.contains("diff-query-display")).toBe(false)
    expect(controller.element.querySelector('[data-query-row-target="toggle"]').classList.contains("bi-caret-down-fill")).toBe(true)
    expect(controller.element.querySelector('[data-query-row-target="toggle"]').classList.contains("d-none")).toBe(true)
  })

  it("renders image queries as thumbnails instead of text", () => {
    controller.queryTextValue = "https://example.test/poster.jpg?size=small"
    controller.render()

    expect(controller.imageTarget.classList.contains("d-none")).toBe(false)
    expect(controller.imageTarget.src).toBe("https://example.test/poster.jpg?size=small")
    expect(controller.textTarget.classList.contains("d-none")).toBe(true)
  })
})
