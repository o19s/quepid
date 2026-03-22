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
        <div data-query-list-target="paginationContainer"></div>
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

  it("handleQueryDeleted removes score and updates case score", () => {
    const list = application.getControllerForElementAndIdentifier(
      document.querySelector("[data-controller=query-list]"),
      "query-list",
    )
    // Pre-populate scores
    list.queryScores = {
      1: { score: 0.5, text: "star wars" },
      2: { score: 1.0, text: "star trek" },
    }

    list.handleQueryDeleted({ detail: { queryId: 1 } })

    expect(list.queryScores[1]).toBeUndefined()
    expect(list.queryScores[2]).toBeDefined()
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

  it("runAllSearches calls rerunSearch on filter-matching outlets across all pages", async () => {
    const list = application.getControllerForElementAndIdentifier(
      document.querySelector("[data-controller=query-list]"),
      "query-list",
    )
    list.queryRowOutlets.forEach((outlet) => {
      vi.spyOn(outlet, "rerunSearch").mockResolvedValue(undefined)
    })

    // Filter to "star" — should run 3 of 4 (star wars, star trek, STARMAN)
    list.filterInputTarget.value = "star"
    list.filter()

    const ev = { preventDefault: vi.fn() }
    await list.runAllSearches(ev)
    expect(ev.preventDefault).toHaveBeenCalled()
    // row1 (star wars), row2 (star trek), row3 (STARMAN) should run
    expect(list.queryRowOutlets[0].rerunSearch).toHaveBeenCalled()
    expect(list.queryRowOutlets[1].rerunSearch).toHaveBeenCalled()
    expect(list.queryRowOutlets[2].rerunSearch).toHaveBeenCalled()
    // row4 (The Boxing Match) should not
    expect(list.queryRowOutlets[3].rerunSearch).not.toHaveBeenCalled()
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

  it("sortBy score sorts rows by computed score (nulls last)", () => {
    const list = application.getControllerForElementAndIdentifier(
      document.querySelector("[data-controller=query-list]"),
      "query-list",
    )
    // Simulate scores: row1 has no score, row2 and row3 have scores
    document.getElementById("row1").dataset.queryId = "1"
    document.getElementById("row2").dataset.queryId = "2"
    document.getElementById("row3").dataset.queryId = "3"
    document.getElementById("row4").dataset.queryId = "4"
    list.queryScores = {
      2: { score: 0.8, text: "star trek" },
      3: { score: 0.5, text: "STARMAN" },
      4: { score: 0.9, text: "The Boxing Match" },
    }

    const link = document.createElement("a")
    link.dataset.sort = "score"
    list.sortBy({ preventDefault: vi.fn(), currentTarget: link })

    const ids = [...list.listTarget.querySelectorAll('[data-query-list-target="queryRow"]')].map(
      (r) => r.id,
    )
    // Highest score first, null-score row last
    expect(ids).toEqual(["row4", "row2", "row3", "row1"])
  })

  // --- Pagination tests ---

  it("shows only the first PAGE_SIZE rows on connect (pagination)", () => {
    // The default 4 rows are all visible (< 15 page size)
    const list = application.getControllerForElementAndIdentifier(
      document.querySelector("[data-controller=query-list]"),
      "query-list",
    )
    // With only 4 rows, all should be visible (no pagination needed)
    list._applyVisibility()
    const visible = list.queryRowTargets.filter((r) => !r.classList.contains("d-none"))
    expect(visible.length).toBe(4)
  })

  it("paginates when there are more than PAGE_SIZE rows", () => {
    // Add enough rows to trigger pagination (15 per page)
    const ul = document.querySelector('[data-query-list-target="list"]')
    for (let i = 5; i <= 20; i++) {
      const li = document.createElement("li")
      li.className = "stub-query-row"
      li.id = `row${i}`
      li.setAttribute("data-controller", "query-row")
      li.setAttribute("data-query-list-target", "queryRow")
      li.setAttribute("data-query-text", `query ${i}`)
      li.setAttribute("data-rated", "true")
      ul.appendChild(li)
    }

    const list = application.getControllerForElementAndIdentifier(
      document.querySelector("[data-controller=query-list]"),
      "query-list",
    )
    list._applyVisibility()

    const visible = list.queryRowTargets.filter((r) => !r.classList.contains("d-none"))
    expect(visible.length).toBe(15)
    expect(list.queryCountTarget.textContent).toBe("20")
  })

  it("goToPage shows the correct page of rows", () => {
    const ul = document.querySelector('[data-query-list-target="list"]')
    for (let i = 5; i <= 20; i++) {
      const li = document.createElement("li")
      li.className = "stub-query-row"
      li.id = `row${i}`
      li.setAttribute("data-controller", "query-row")
      li.setAttribute("data-query-list-target", "queryRow")
      li.setAttribute("data-query-text", `query ${i}`)
      li.setAttribute("data-rated", "true")
      ul.appendChild(li)
    }

    const list = application.getControllerForElementAndIdentifier(
      document.querySelector("[data-controller=query-list]"),
      "query-list",
    )
    list._applyVisibility()

    // Go to page 2
    list.goToPage({ preventDefault: vi.fn(), currentTarget: { dataset: { page: "2" } } })
    const visible = list.queryRowTargets.filter((r) => !r.classList.contains("d-none"))
    expect(visible.length).toBe(5) // 20 total - 15 on page 1 = 5 on page 2
    expect(list.currentPage).toBe(2)
  })

  it("nextPage and previousPage navigate correctly", () => {
    const ul = document.querySelector('[data-query-list-target="list"]')
    for (let i = 5; i <= 20; i++) {
      const li = document.createElement("li")
      li.className = "stub-query-row"
      li.id = `row${i}`
      li.setAttribute("data-controller", "query-row")
      li.setAttribute("data-query-list-target", "queryRow")
      li.setAttribute("data-query-text", `query ${i}`)
      li.setAttribute("data-rated", "true")
      ul.appendChild(li)
    }

    const list = application.getControllerForElementAndIdentifier(
      document.querySelector("[data-controller=query-list]"),
      "query-list",
    )
    list._applyVisibility()

    const ev = { preventDefault: vi.fn() }

    list.nextPage(ev)
    expect(list.currentPage).toBe(2)

    list.previousPage(ev)
    expect(list.currentPage).toBe(1)

    // previousPage at page 1 should not go below 1
    list.previousPage(ev)
    expect(list.currentPage).toBe(1)
  })

  it("filter resets to page 1", () => {
    const list = application.getControllerForElementAndIdentifier(
      document.querySelector("[data-controller=query-list]"),
      "query-list",
    )
    list.currentPage = 3
    list.filterInputTarget.value = "star"
    list.filter()
    expect(list.currentPage).toBe(1)
  })

  it("sortBy resets to page 1", () => {
    const list = application.getControllerForElementAndIdentifier(
      document.querySelector("[data-controller=query-list]"),
      "query-list",
    )
    list.currentPage = 2
    const nameLink = [...list.sortLinkTargets].find((a) => a.dataset.sort === "query")
    list.sortBy({ preventDefault: vi.fn(), currentTarget: nameLink })
    expect(list.currentPage).toBe(1)
  })

  it("sortBy modified sorts rows by data-modified-at descending", () => {
    const list = application.getControllerForElementAndIdentifier(
      document.querySelector("[data-controller=query-list]"),
      "query-list",
    )
    document.getElementById("row1").dataset.modifiedAt = "2025-01-01T00:00:00Z"
    document.getElementById("row2").dataset.modifiedAt = "2025-03-01T00:00:00Z"
    document.getElementById("row3").dataset.modifiedAt = "2025-02-01T00:00:00Z"
    document.getElementById("row4").dataset.modifiedAt = "2024-12-01T00:00:00Z"

    const link = document.createElement("a")
    link.dataset.sort = "modified"
    list.sortBy({ preventDefault: vi.fn(), currentTarget: link })

    const ids = [...list.listTarget.querySelectorAll('[data-query-list-target="queryRow"]')].map(
      (r) => r.id,
    )
    // Most recently modified first
    expect(ids).toEqual(["row2", "row3", "row1", "row4"])
  })

  it("sortBy error sorts error rows to the top", () => {
    const list = application.getControllerForElementAndIdentifier(
      document.querySelector("[data-controller=query-list]"),
      "query-list",
    )
    document.getElementById("row1").dataset.queryId = "1"
    document.getElementById("row2").dataset.queryId = "2"
    document.getElementById("row3").dataset.queryId = "3"
    document.getElementById("row4").dataset.queryId = "4"
    list.queryScores = {
      1: { score: 0.5, text: "star wars" },
      2: { score: null, text: "star trek" }, // error
      3: { score: 0.8, text: "STARMAN" },
      // row4 has no entry — not yet scored, not an error
    }

    const link = document.createElement("a")
    link.dataset.sort = "error"
    list.sortBy({ preventDefault: vi.fn(), currentTarget: link })

    const ids = [...list.listTarget.querySelectorAll('[data-query-list-target="queryRow"]')].map(
      (r) => r.id,
    )
    // row2 (error) should be first
    expect(ids[0]).toBe("row2")
  })
})
