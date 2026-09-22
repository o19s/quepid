import { describe, expect, it } from "vitest"
import SearchResultController from "controllers/search_result_controller"

function buildController(scope) {
  const element = document.createElement("search-result")
  element.setAttribute("rank", "2")
  document.body.appendChild(element)
  const controller = Object.create(SearchResultController.prototype)
  controller.element = element
  controller.angularScope = scope
  controller.hasContentTarget = true
  controller.contentTarget = document.createElement("div")
  element.appendChild(controller.contentTarget)
  controller.explainViewValue = ""
  return controller
}

function scopeFor(overrides = {}) {
  const doc = {
    title: "A result",
    thumb: null,
    image: null,
    embeds: {},
    translations: {},
    unabridgeds: {},
    error: undefined,
    subSnippets: () => ({ title: "<strong>A result</strong>" }),
    hasThumb: () => false,
    hasImage: () => false,
    hasRating: () => false,
    getRating: () => null
  }
  const query = { depthOfRating: 0 }
  return {
    doc: { ...doc, ...overrides.doc },
    query: { ...query, ...overrides.query },
    ratings: { scale: {} },
    resolveFieldValue: () => "A result"
  }
}

describe("SearchResultController", () => {
  it("renders the document title, fields, and rank", () => {
    const controller = buildController(scopeFor())
    controller.render()

    expect(controller.contentTarget.querySelector(".subTitle").textContent).toContain("A result")
    expect(controller.contentTarget.querySelector(".result-rank").textContent).toContain("Rank: #2")
    expect(controller.contentTarget.querySelector("strong").textContent).toBe("A result")
  })

  it("renders an error without a rating control", () => {
    const controller = buildController(scopeFor({ doc: { error: "missing id" } }))
    controller.render()

    expect(controller.contentTarget.querySelector(".single-rating")).toBeNull()
    expect(controller.contentTarget.textContent).toContain("missing id")
  })

  it("preserves falsy field values", () => {
    const controller = buildController(scopeFor({
      doc: {
        subSnippets: () => ({ zero: 0, falseValue: false })
      }
    }))
    controller.render()

    expect(controller.contentTarget.textContent).toContain("0")
    expect(controller.contentTarget.textContent).toContain("false")
  })

  it("uses the rating scale and preserves the Angular mutation bridge", () => {
    const doc = scopeFor().doc
    doc.hasRating = () => true
    doc.getRating = () => 2
    const controller = buildController({ ...scopeFor({ doc }), ratings: { scale: { 2: { color: "green" } } } })
    controller.render()

    const rating = controller.contentTarget.querySelector(".single-rating")
    expect(rating.dataset.controller).toBe("rating-popover")
    expect(rating.querySelector(".btn").textContent).toContain("2")
    expect(rating.querySelector(".btn").style.backgroundColor).toBe("green")
  })
})
