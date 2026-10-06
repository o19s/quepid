import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Application } from "@hotwired/stimulus"
import QueryUnratedBadgeController from "controllers/query_unrated_badge_controller"
import { CaseScoreStore } from "stores/case_score_store"
import { viewTemplateTargets } from "../support/view_template"

vi.mock("@hotwired/stimulus", () => import("../../../node_modules/@hotwired/stimulus/dist/stimulus.js"))
vi.mock("utils/core_store_access", () => ({ getCoreStores: () => ({ scoring: store }) }))

let store

describe("query-unrated-badge ERB wiring with real Stimulus", () => {
  let application
  let row
  let badge
  let count

  beforeEach(async () => {
    store = new CaseScoreStore()
    const { rowTemplate } = viewTemplateTargets("app/views/core/_query_list_templates.html.erb", "queries-list")
    row = rowTemplate.content.firstElementChild.cloneNode(true)
    badge = row.querySelector('[data-slot="unratedBadge"]')
    count = badge.querySelector(".notification-bubble")
    // The list runtime supplies the query ID when cloning this static shell.
    badge.dataset.queryUnratedBadgeQueryIdValue = "1"
    document.body.append(row)

    application = Application.start()
    application.register("query-unrated-badge", QueryUnratedBadgeController)
    await vi.waitFor(() => {
      expect(application.getControllerForElementAndIdentifier(badge, "query-unrated-badge")).not.toBeNull()
    })
  })

  afterEach(async () => {
    row?.remove()
    if (application && badge) {
      await vi.waitFor(() => {
        expect(application.getControllerForElementAndIdentifier(badge, "query-unrated-badge")).toBeNull()
      })
    }
    application?.stop()
    document.body.replaceChildren()
    store = undefined
  })

  function scoreQueries(queries) {
    store.setLatestScoreInfo({ allRated: false, score: 0.5, queries })
  }

  it("resolves the ERB count target and responds to query ID attribute changes", async () => {
    expect(badge.classList.contains("d-none")).toBe(true)
    scoreQueries({
      1: { score: 0.5, allRated: false, countMissingRatings: 3 },
      2: { score: 0.5, allRated: false, countMissingRatings: 7 }
    })
    expect(badge.classList.contains("d-none")).toBe(false)
    expect(count.textContent).toBe("3")

    badge.dataset.queryUnratedBadgeQueryIdValue = "2"
    await vi.waitFor(() => expect(count.textContent).toBe("7"))

    scoreQueries({
      1: { score: 0.5, allRated: false, countMissingRatings: 3 },
      2: { score: 1, allRated: true, countMissingRatings: 0 }
    })
    expect(badge.classList.contains("d-none")).toBe(true)
  })

  it("unsubscribes when removed and resumes rendering when reconnected", async () => {
    scoreQueries({ 1: { score: 0.5, allRated: false, countMissingRatings: 3 } })
    expect(count.textContent).toBe("3")

    row.remove()
    await vi.waitFor(() => {
      expect(application.getControllerForElementAndIdentifier(badge, "query-unrated-badge")).toBeNull()
    })
    scoreQueries({ 1: { score: 0.5, allRated: false, countMissingRatings: 5 } })
    expect(count.textContent).toBe("3")

    document.body.append(row)
    await vi.waitFor(() => {
      expect(application.getControllerForElementAndIdentifier(badge, "query-unrated-badge")).not.toBeNull()
      expect(count.textContent).toBe("5")
    })
    scoreQueries({ 1: { score: 0.5, allRated: false, countMissingRatings: 6 } })
    expect(count.textContent).toBe("6")
  })
})
