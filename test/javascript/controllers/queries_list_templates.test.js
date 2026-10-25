import { buildControllerFixture } from "../support/controller_fixture"
import { describe, expect, it } from "vitest"
import QueriesListController from "controllers/queries_list_controller"
import { viewTemplateTargets } from "../support/view_template"

const TEMPLATES = "app/views/core/_query_list_templates.html.erb"

function controller() {
  const targets = viewTemplateTargets(TEMPLATES, "queries-list")
  return buildControllerFixture(QueriesListController, {
    targets: {
      rowTemplate: targets.rowTemplate,
      searchResultsTemplate: targets.searchResultsTemplate,
      diffScoreTemplate: targets.diffScoreTemplate
    },
    values: {
      queryUrlTemplate: "/api/cases/6/queries/__QUERY_ID__",
      notesUrlTemplate: "/api/cases/6/queries/__QUERY_ID__/notes"
    }
  })
}

function searchResults(query) {
  const root = document.createElement("div")
  root.appendChild(controller().buildSearchResults({ caseNo: 6, queryId: 8, ...query }))
  return root
}

describe("query list templates", () => {
  it("names the icon-only query controls", () => {
    const root = searchResults()

    const copy = root.querySelector('[data-action="click->search-results#copyQuery"]')
    expect(copy.getAttribute("aria-label")).toBe("Copy query")
    expect(copy.getAttribute("title")).toBe("Copy query")
    expect(root.querySelector(".results-pane-toggle").getAttribute("aria-label")).toBe("Close the results pane")
    expect(root.querySelector(".results-pane-toggle").tagName).toBe("BUTTON")
  })

  it("wires the in-row query actions to the query's id and the server's API URLs", () => {
    const root = searchResults()

    const explain = root.querySelector('[data-controller="query-explain"]')
    expect(explain.dataset.queryExplainQueryIdValue).toBe("8")
    expect(explain.dataset.queryExplainQueriesListOutlet).toBe("#query-container")
    expect(root.querySelector('[data-controller="missing-documents"]').dataset.missingDocumentsQueryIdValue).toBe("8")
    expect(root.querySelector('[data-controller="query-delete"]').dataset).toMatchObject({
      queryDeleteQueryIdValue: "8",
      queryDeleteDeleteUrlValue: "/api/cases/6/queries/8"
    })
    expect(root.querySelector('[data-controller="query-notes"]').dataset.queryNotesUrlValue).toBe(
      "/api/cases/6/queries/8/notes"
    )
    // The row-opened modals read the query from the row, so their buttons carry nothing per query.
    expect(Object.keys(root.querySelector('[data-bs-target="#queryOptionsModal"]').dataset)).toEqual(["bsToggle", "bsTarget"])
    expect(Object.keys(root.querySelector('[data-bs-target="#moveQueryModal"]').dataset)).toEqual(["bsToggle", "bsTarget"])
  })

  it("ties each notes label to its field", () => {
    const root = searchResults()

    expect(root.querySelector('label[for="information-8"]').nextElementSibling.firstElementChild).toBe(
      root.querySelector('[data-query-notes-target="informationNeed"]#information-8')
    )
    expect(root.querySelector('label[for="notes-8"]').nextElementSibling.firstElementChild).toBe(
      root.querySelector('[data-query-notes-target="notes"]#notes-8')
    )
  })

  it("keeps hostile ids out of the markup", () => {
    const root = searchResults({ queryId: '1"><img src=x>' })

    expect(root.querySelector("img")).toBeNull()
  })

  it("keeps hostile query text and information needs out of the row markup", () => {
    const row = document.createElement("li")
    const instance = controller()
    const query = { queryId: 3, queryText: "<img src=x>", informationNeed: '"><img src=y>' }
    instance.renderQueryShell(row, query)
    instance.updateQueryRow(row, query, 1, false)

    expect(row.querySelector("img:not(.query-thumbnail)")).toBeNull()
    const shell = row.querySelector('[data-controller="query-row"]')
    expect(shell.dataset.queryRowQueryTextValue).toBe("<img src=x>")
    expect(shell.querySelector('[data-query-row-target="query"]').dataset.bsTooltipTitleValue).toBe(
      'Info Need: "><img src=y>'
    )
  })
})
