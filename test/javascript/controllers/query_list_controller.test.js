import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { Application, Controller } from "@hotwired/stimulus"
import QueryListController from "../../../app/javascript/controllers/query_list_controller"
import { waitForController } from "../support/stimulus_helpers"

/**
 * Stubs for query-list outlets. Covers the same behaviors as Angular QueriesCtrl
 * (query text filter, rated filter) and wiring to case score (qscore-case style).
 */
class StubQueryRowController extends Controller {
  expanded = false

  collapse() {
    this.expanded = false
  }

  async rerunSearch() {
    return undefined
  }
}

class StubCaseScoreController extends Controller {
  updates = []

  updateScore(data) {
    this.updates.push(data)
  }
}

describe("QueryListController", () => {
  let application

  function mountListHtml() {
    document.body.innerHTML = `
      <div data-controller="query-list"
           data-query-list-query-row-outlet=".stub-query-row"
           data-query-list-case-score-outlet="#case-score-stub"
           data-action="query-row:score-changed->query-list#handleScoreChanged">
        <input type="search" data-query-list-target="filterInput" />
        <input type="checkbox" data-query-list-target="showOnlyRatedCheckbox" />
        <span data-query-list-target="queryCount">0</span>
        <a href="#" data-query-list-target="sortLink" data-sort="query">Name</a>
        <a href="#" data-query-list-target="sortLink" data-sort="default" class="active">Manual</a>
        <ul data-query-list-target="list">
          <li class="stub-query-row" id="row1"
              data-controller="query-row"
              data-query-list-target="queryRow"
              data-query-text="star wars"
              data-rated="true"></li>
          <li class="stub-query-row" id="row2"
              data-controller="query-row"
              data-query-list-target="queryRow"
              data-query-text="star trek"
              data-rated="true"></li>
          <li class="stub-query-row" id="row3"
              data-controller="query-row"
              data-query-list-target="queryRow"
              data-query-text="STARMAN"
              data-rated="true"></li>
          <li class="stub-query-row" id="row4"
              data-controller="query-row"
              data-query-list-target="queryRow"
              data-query-text="The Boxing Match"
              data-rated="false"></li>
        </ul>
        <div id="case-score-stub" data-controller="case-score"></div>
      </div>
    `
  }

  beforeEach(async () => {
    mountListHtml()
    application = Application.start()
    application.register("query-list", QueryListController)
    application.register("query-row", StubQueryRowController)
    application.register("case-score", StubCaseScoreController)
    await waitForController(application, '[data-controller="query-list"]', "query-list")
  })

  afterEach(() => {
    application.stop()
  })

  it("shows all rows when filter is empty (matches QueriesCtrl: no filter matches everything)", () => {
    const list = application.getControllerForElementAndIdentifier(
      document.querySelector("[data-controller=query-list]"),
      "query-list",
    )
    list.filterInputTarget.value = ""
    list.filter()

    expect(document.getElementById("row1").classList.contains("d-none")).toBe(false)
    expect(document.getElementById("row2").classList.contains("d-none")).toBe(false)
    expect(document.getElementById("row3").classList.contains("d-none")).toBe(false)
    expect(document.getElementById("row4").classList.contains("d-none")).toBe(false)
    expect(list.queryCountTarget.textContent).toBe("4")
  })

  it("filters by substring case-insensitively (matches QueriesCtrl filter tests)", () => {
    const list = application.getControllerForElementAndIdentifier(
      document.querySelector("[data-controller=query-list]"),
      "query-list",
    )

    list.filterInputTarget.value = "star"
    list.filter()
    expect(document.getElementById("row1").classList.contains("d-none")).toBe(false)
    expect(document.getElementById("row2").classList.contains("d-none")).toBe(false)
    expect(document.getElementById("row3").classList.contains("d-none")).toBe(false)
    expect(document.getElementById("row4").classList.contains("d-none")).toBe(true)
    expect(list.queryCountTarget.textContent).toBe("3")

    list.filterInputTarget.value = "boxing"
    list.filter()
    expect(document.getElementById("row1").classList.contains("d-none")).toBe(true)
    expect(document.getElementById("row2").classList.contains("d-none")).toBe(true)
    expect(document.getElementById("row3").classList.contains("d-none")).toBe(true)
    expect(document.getElementById("row4").classList.contains("d-none")).toBe(false)
    expect(list.queryCountTarget.textContent).toBe("1")

    list.filterInputTarget.value = "Star"
    list.filter()
    expect(list.queryCountTarget.textContent).toBe("3")

    list.filterInputTarget.value = "war"
    list.filter()
    expect(document.getElementById("row1").classList.contains("d-none")).toBe(false)
    expect(document.getElementById("row2").classList.contains("d-none")).toBe(true)
  })

  it("show only rated hides unrated rows", () => {
    const list = application.getControllerForElementAndIdentifier(
      document.querySelector("[data-controller=query-list]"),
      "query-list",
    )
    list.filterInputTarget.value = ""
    list.filter()

    const ev = { preventDefault: vi.fn() }
    list.toggleShowOnlyRated(ev)
    expect(ev.preventDefault).toHaveBeenCalled()
    expect(list.showOnlyRatedCheckboxTarget.checked).toBe(true)
    expect(document.getElementById("row4").classList.contains("d-none")).toBe(true)
    expect(list.queryCountTarget.textContent).toBe("3")
  })

  it("forwards aggregated score to case-score outlet after score-changed (qscore-case wiring)", () => {
    const caseScoreEl = document.getElementById("case-score-stub")
    const caseScore = application.getControllerForElementAndIdentifier(caseScoreEl, "case-score")

    const row1 = document.getElementById("row1")
    row1.dispatchEvent(
      new CustomEvent("query-row:score-changed", {
        bubbles: true,
        detail: {
          queryId: 1,
          queryText: "star wars",
          score: 0.5,
          maxScore: 10,
          numFound: 100,
        },
      }),
    )
    row1.dispatchEvent(
      new CustomEvent("query-row:score-changed", {
        bubbles: true,
        detail: {
          queryId: 2,
          queryText: "star trek",
          score: 1.0,
          maxScore: 10,
          numFound: 50,
        },
      }),
    )

    expect(caseScore.updates.length).toBeGreaterThanOrEqual(1)
    const last = caseScore.updates[caseScore.updates.length - 1]
    expect(last.score).toBeCloseTo(0.75)
    expect(last.allRated).toBe(true)
    expect(last.queryScores[1].score).toBe(0.5)
    expect(last.queryScores[2].score).toBe(1.0)
  })

  it("collapseAll calls collapse on expanded query-row outlets", () => {
    const list = application.getControllerForElementAndIdentifier(
      document.querySelector("[data-controller=query-list]"),
      "query-list",
    )
    const rowOutlet = list.queryRowOutlets[0]
    const collapseSpy = vi.spyOn(rowOutlet, "collapse")
    rowOutlet.expanded = true

    const ev = { preventDefault: vi.fn() }
    list.collapseAll(ev)
    expect(ev.preventDefault).toHaveBeenCalled()
    expect(collapseSpy).toHaveBeenCalled()
  })

  it("runAllSearches calls rerunSearch on visible outlets only", async () => {
    const list = application.getControllerForElementAndIdentifier(
      document.querySelector("[data-controller=query-list]"),
      "query-list",
    )
    list.queryRowOutlets.forEach((outlet) => {
      vi.spyOn(outlet, "rerunSearch").mockResolvedValue(undefined)
    })

    document.getElementById("row1").classList.add("d-none")

    const ev = { preventDefault: vi.fn() }
    await list.runAllSearches(ev)
    expect(ev.preventDefault).toHaveBeenCalled()
    expect(list.queryRowOutlets[0].rerunSearch).not.toHaveBeenCalled()
    expect(list.queryRowOutlets[1].rerunSearch).toHaveBeenCalled()
  })

  it("sortBy query reorders rows by query text", () => {
    const list = application.getControllerForElementAndIdentifier(
      document.querySelector("[data-controller=query-list]"),
      "query-list",
    )
    const nameLink = [...list.sortLinkTargets].find((a) => a.dataset.sort === "query")
    const ev = { preventDefault: vi.fn(), currentTarget: nameLink }
    list.sortBy(ev)

    const rows = [...list.listTarget.querySelectorAll('[data-query-list-target="queryRow"]')]
    const texts = rows.map((r) => r.dataset.queryText)
    const expectedOrder = ["star wars", "star trek", "STARMAN", "The Boxing Match"].sort((a, b) =>
      a.localeCompare(b),
    )
    expect(texts).toEqual(expectedOrder)
    expect(nameLink.classList.contains("active")).toBe(true)
  })

  it("sortBy default restores server-rendered row order after sorting by name", () => {
    const list = application.getControllerForElementAndIdentifier(
      document.querySelector("[data-controller=query-list]"),
      "query-list",
    )
    const initialIds = [
      ...list.listTarget.querySelectorAll('[data-query-list-target="queryRow"]'),
    ].map((r) => r.id)

    const nameLink = [...list.sortLinkTargets].find((a) => a.dataset.sort === "query")
    list.sortBy({ preventDefault: vi.fn(), currentTarget: nameLink })
    const afterNameIds = [
      ...list.listTarget.querySelectorAll('[data-query-list-target="queryRow"]'),
    ].map((r) => r.id)
    expect(afterNameIds).not.toEqual(initialIds)

    const defaultLink = [...list.sortLinkTargets].find((a) => a.dataset.sort === "default")
    list.sortBy({ preventDefault: vi.fn(), currentTarget: defaultLink })
    const restoredIds = [
      ...list.listTarget.querySelectorAll('[data-query-list-target="queryRow"]'),
    ].map((r) => r.id)
    expect(restoredIds).toEqual(initialIds)
    expect(defaultLink.classList.contains("active")).toBe(true)
  })

  it("sortBy score and modified restore manual order until dedicated sort keys exist", () => {
    const list = application.getControllerForElementAndIdentifier(
      document.querySelector("[data-controller=query-list]"),
      "query-list",
    )
    const initialIds = [
      ...list.listTarget.querySelectorAll('[data-query-list-target="queryRow"]'),
    ].map((r) => r.id)

    const nameLink = [...list.sortLinkTargets].find((a) => a.dataset.sort === "query")
    list.sortBy({ preventDefault: vi.fn(), currentTarget: nameLink })

    for (const sortKey of ["score", "modified"]) {
      const link = document.createElement("a")
      link.href = "#"
      link.dataset.sort = sortKey
      link.dataset.queryListTarget = "sortLink"
      list.sortBy({ preventDefault: vi.fn(), currentTarget: link })
      const ids = [...list.listTarget.querySelectorAll('[data-query-list-target="queryRow"]')].map(
        (r) => r.id,
      )
      expect(ids).toEqual(initialIds)
    }
  })
})
