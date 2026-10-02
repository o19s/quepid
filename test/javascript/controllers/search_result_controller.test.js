import { describe, expect, it, vi } from "vitest"
import SearchResultController from "controllers/search_result_controller"

function buildController(documentSnapshot, querySnapshot = {}) {
  const element = document.createElement("search-result")
  element.setAttribute("rank", "2")
  document.body.appendChild(element)
  const controller = Object.create(SearchResultController.prototype)
  controller.element = element
  element.__searchResultDocument = documentSnapshot
  element.__searchResultQuery = querySnapshot
  controller.hasContentTarget = true
  controller.contentTarget = document.createElement("div")
  element.appendChild(controller.contentTarget)
  controller.explainViewValue = ""
  return controller
}

function snapshotFor(overrides = {}) {
  const doc = {
    id: "doc-1",
    title: "A result",
    thumb: null,
    image: null,
    embeds: {},
    translations: {},
    unabridgeds: {},
    error: undefined,
    snippets: { title: "<strong>A result</strong>" },
    rawFields: { title: "A result" },
    hasThumb: false,
    hasImage: false,
    rating: null
  }
  return { ...doc, ...overrides }
}

describe("SearchResultController", () => {
  it("renders the document title, fields, and rank", () => {
    const controller = buildController(snapshotFor(), { depthOfRating: 0, ratingScale: {} })
    controller.render()

    expect(controller.contentTarget.querySelector(".subTitle").textContent).toContain("A result")
    expect(controller.contentTarget.querySelector(".result-rank").textContent).toContain("Rank: #2")
    expect(controller.contentTarget.querySelector("strong").textContent).toBe("A result")
  })

  it("routes title clicks through a declared action that requests the rendered document", () => {
    const controller = buildController(snapshotFor({ id: 42 }), { depthOfRating: 0, ratingScale: {} })
    controller.render()
    const titleLink = controller.contentTarget.querySelector(".subTitle a")
    const events = []
    document.body.addEventListener("search-result:show-document", event => events.push(event.detail))
    const event = { preventDefault: vi.fn() }

    controller.showDocument(event)

    expect(titleLink.dataset.action).toBe("search-result#showDocument")
    expect(event.preventDefault).toHaveBeenCalled()
    expect(events).toEqual([{ docId: 42 }])
  })

  it("renders an error without a rating control", () => {
    const controller = buildController(snapshotFor({ error: "missing id" }), { depthOfRating: 0, ratingScale: {} })
    controller.render()

    expect(controller.contentTarget.querySelector(".single-rating")).toBeNull()
    expect(controller.contentTarget.textContent).toContain("missing id")
  })

  it("separates each field label from its value with a space", () => {
    const controller = buildController(snapshotFor({
      snippets: { structure: "Corporations" },
      rawFields: { structure: "Corporations" }
    }), { depthOfRating: 0, ratingScale: {} })
    controller.render()

    const label = controller.contentTarget.querySelector(".subLabel")
    expect(label.parentElement.textContent).toContain("structure: Corporations")
  })

  it("preserves falsy field values", () => {
    const controller = buildController(snapshotFor({
      snippets: { zero: "0", falseValue: "false" },
      rawFields: { zero: 0, falseValue: false }
    }), { depthOfRating: 0, ratingScale: {} })
    controller.render()

    expect(controller.contentTarget.textContent).toContain("0")
    expect(controller.contentTarget.textContent).toContain("false")
  })

  it("uses the rating scale and preserves the mutation bridge", () => {
    const controller = buildController(snapshotFor({ rating: 2 }), {
      depthOfRating: 0,
      ratingScale: { 2: { color: "green" } }
    })
    controller.render()

    const rating = controller.contentTarget.querySelector(".single-rating")
    expect(rating.dataset.controller).toBe("rating-popover")
    expect(rating.querySelector(".btn").textContent).toContain("2")
    expect(rating.querySelector(".btn").style.backgroundColor).toBe("green")
  })
})
