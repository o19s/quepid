import { buildControllerFixture } from "../support/controller_fixture"
import { beforeEach, describe, expect, it, vi } from "vitest"
import SearchResultController from "controllers/search_result_controller"
import { loadViewTemplate } from "../support/view_template"

function buildController(documentSnapshot, querySnapshot = {}) {
  const element = document.createElement("search-result")
  element.setAttribute("rank", "2")
  document.body.appendChild(element)
  const controller = buildControllerFixture(SearchResultController, {
    element,
    targets: { content: document.createElement("div") },
    values: { explainView: "" }
  })
  element.__searchResultDocument = documentSnapshot
  element.__searchResultQuery = querySnapshot
  element.appendChild(controller.contentTarget)
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
  beforeEach(() => {
    // Provides the shipped <template id="search-result-template">.
    document.body.innerHTML = loadViewTemplate("app/views/core/_query_list_templates.html.erb")
  })

  it("renders the document title, fields, and rank", () => {
    const controller = buildController(snapshotFor(), { depthOfRating: 0, ratingScale: {} })
    controller.render()

    expect(controller.contentTarget.querySelector(".subTitle").textContent).toContain("A result")
    const trigger = controller.contentTarget.querySelector(".single-rating button")
    expect(trigger.textContent).toContain("Unrated")
    expect(trigger.getAttribute("aria-label")).toBe("Rate document: Unrated")
    expect(controller.contentTarget.querySelector(".result-rank").textContent).toContain("Rank: #2")
    expect(controller.contentTarget.querySelector("strong").textContent).toBe("A result")
  })

  it("keeps keyboard focus on the rating trigger when a rating change re-renders the row", () => {
    const controller = buildController(snapshotFor(), { depthOfRating: 0, ratingScale: {} })
    controller.render()
    controller.contentTarget.querySelector(".single-rating button").focus()

    controller.element.__searchResultDocument = snapshotFor({ rating: 2 })
    controller.render()

    expect(document.activeElement.getAttribute("aria-label")).toBe("Change rating: 2")
  })

  it("does not pull focus into a re-rendered row that did not have it", () => {
    const controller = buildController(snapshotFor(), { depthOfRating: 0, ratingScale: {} })
    controller.render()
    controller.render()

    expect(document.activeElement).toBe(document.body)
  })

  it("routes title clicks through a declared action that requests the rendered document", () => {
    const controller = buildController(snapshotFor({ id: 42 }), { depthOfRating: 0, ratingScale: {} })
    controller.render()
    const titleButton = controller.contentTarget.querySelector(".subTitle button")
    const events = []
    document.body.addEventListener("search-result:show-document", event => events.push(event.detail))
    const event = { preventDefault: vi.fn() }

    controller.showDocument(event)

    expect(titleButton.dataset.action).toBe("search-result#showDocument")
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

  it("embeds media when an extension appears anywhere in the value, as Legacy did", () => {
    const embeds = {
      fragment: "https://example.org/clip.mp3#t=5",
      queryString: "https://example.org/stream?file=a.wav",
      movie: "https://example.org/movie.webm",
      imageBeforeVideo: "https://example.org/clip.mp4?poster=x.jpg"
    }
    const controller = buildController(snapshotFor({ embeds }), { depthOfRating: 0, ratingScale: {} })
    controller.render()

    const srcs = (selector) => [...controller.contentTarget.querySelectorAll(selector)].map(el => el.getAttribute("src"))
    expect(srcs("audio.media-embed")).toEqual([embeds.fragment, embeds.queryString])
    expect(srcs("video.media-embed")).toEqual([embeds.movie])
    expect(srcs("img.media-embed")).toEqual([embeds.imageBeforeVideo])
  })

  it("shows a value with no media extension as text, matching the extension's case and a literal dot", () => {
    const controller = buildController(snapshotFor({
      embeds: { upper: "https://example.org/CLIP.MP3", noDot: "https://example.org/mp3s/list", overview: "plain text" }
    }), { depthOfRating: 0, ratingScale: {} })
    controller.render()

    const content = controller.contentTarget
    expect(content.querySelector(".media-embed")).toBeNull()
    expect(content.textContent).toContain("upper: https://example.org/CLIP.MP3")
    expect(content.textContent).toContain("noDot: https://example.org/mp3s/list")
    expect(content.textContent).toContain("overview: plain text")
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

  it("re-renders only when search-results gives it a new version", () => {
    const controller = buildController(snapshotFor(), { depthOfRating: 0, ratingScale: {} })
    controller.versionValue = 1
    controller.render()
    const rendered = controller.contentTarget.firstElementChild

    controller.versionValueChanged(1)
    expect(controller.contentTarget.firstElementChild).toBe(rendered)

    controller.element.__searchResultDocument = snapshotFor({ title: "Renamed" })
    controller.versionValue = 2
    controller.versionValueChanged(2)
    expect(controller.contentTarget.firstElementChild).not.toBe(rendered)
    expect(controller.contentTarget.textContent).toContain("Renamed")
  })
})
