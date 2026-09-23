import { Controller } from "@hotwired/stimulus"
import { copyText } from "utils/clipboard"
import { openDynamicModal } from "utils/dynamic_modal"
import { renderJsonExplorer, escapeHtml } from "utils/json_explorer"

const TABS = [
  { key: "queryDetails", tabId: "query-explain-tab-params", paneId: "query-explain-pane-params" },
  { key: "parsedQueryDetails", tabId: "query-explain-tab-parsing", paneId: "query-explain-pane-parsing" },
  { key: "renderedQueryTemplate", tabId: "query-explain-tab-template", paneId: "query-explain-pane-template" }
]

/**
 * "Explain Query" modal on the per-query toolbar (was the `query_explain`
 * Angular component's `$quepidModal` + `QueryExplainModalInstanceCtrl`).
 *
 * Params/Parsing tabs are sync data computed by the query-list controller into
 * `data-query-explain-data-value` (same bridge pattern as match-explain).
 * The Query Template tab needs a live network call
 * (`query.searcher.renderTemplate()`, ES/OS-only) that still runs through the
 * live searcher, so it's requested via a bubbling `query-explain:render-template`
 * CustomEvent and delivered back via `query-explain:template-rendered`.
 * Re-requested every time the tab is shown, matching the
 * deleted template's `ng-click="ctrl.renderQueryTemplate()"` on the tab
 * button itself.
 */
export default class extends Controller {
  static values = { data: Object }

  connect() {
    this.element.innerHTML = `
      <button type="button" class="btn btn-outline-secondary btn-sm">Explain Query</button>
    `
    this.element.querySelector("button").addEventListener("click", () => {
      const event = new CustomEvent("query-explain:before-open", {
        bubbles: true,
        detail: { data: this.dataValue }
      })
      this.element.dispatchEvent(event)
      this.open(event.detail.data)
    })
  }

  open(data = this.dataValue) {
    this.toggledPanel = "queryDetails"

    const modal = openDynamicModal({
      html: `
        <div class="modal-header">
          <h3 class="modal-title" id="query-explain-modal-title">Explain Query Parsing</h3>
          <button type="button" class="btn-core-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <p>These are details returned from the search engine on how it processed the input query</p>
          <ul class="nav nav-tabs" role="tablist">
            <li class="nav-item" role="presentation">
              <button type="button" class="nav-link active" id="query-explain-tab-params"
                      data-bs-toggle="tab" data-bs-target="#query-explain-pane-params"
                      role="tab" aria-controls="query-explain-pane-params" aria-selected="true">Params</button>
            </li>
            <li class="nav-item" role="presentation">
              <button type="button" class="nav-link" id="query-explain-tab-parsing"
                      data-bs-toggle="tab" data-bs-target="#query-explain-pane-parsing"
                      role="tab" aria-controls="query-explain-pane-parsing" aria-selected="false">Parsing</button>
            </li>
            <li class="nav-item" role="presentation">
              <button type="button" class="nav-link" id="query-explain-tab-template"
                      data-bs-toggle="tab" data-bs-target="#query-explain-pane-template"
                      role="tab" aria-controls="query-explain-pane-template" aria-selected="false">Query Template</button>
            </li>
          </ul>
          <div class="tab-content">
            <div class="tab-pane active" id="query-explain-pane-params" role="tabpanel" aria-labelledby="query-explain-tab-params">
              ${
                data.queryDetailsMessage
                  ? `<p class="bg-warning text-warning-emphasis p-3"><i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i> ${escapeHtml(data.queryDetailsMessage)}</p>`
                  : `<p>These are the query parameters processed by the search engine.</p><div class="query-explain-params"></div>`
              }
            </div>
            <div class="tab-pane" id="query-explain-pane-parsing" role="tabpanel" aria-labelledby="query-explain-tab-parsing">
              <p>This is how the search engine parsed the query.</p>
              <div class="query-explain-parsing"></div>
            </div>
            <div class="tab-pane" id="query-explain-pane-template" role="tabpanel" aria-labelledby="query-explain-tab-template">
              <div class="query-explain-template"></div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline-secondary float-start me-auto query-explain-copy" data-tab="queryDetails"><i class="bi bi-copy"></i> Copy</button>
          <button class="btn btn-outline-secondary float-start me-auto query-explain-copy d-none" data-tab="parsedQueryDetails"><i class="bi bi-copy"></i> Copy</button>
          <button class="btn btn-outline-secondary float-start me-auto query-explain-copy d-none" data-tab="renderedQueryTemplate"><i class="bi bi-copy"></i> Copy</button>
          <button class="btn btn-primary" data-bs-dismiss="modal">Close</button>
        </div>
      `,
      size: "lg",
      ariaLabelledBy: "query-explain-modal-title"
    })

    this.wireModal(modal.element, data)
  }

  wireModal(el, data) {
    if (!data.queryDetailsMessage) {
      renderJsonExplorer(el.querySelector(".query-explain-params"), data.queryDetails, { collapsed: false })
    }
    renderJsonExplorer(el.querySelector(".query-explain-parsing"), data.parsedQueryDetails, { collapsed: false })

    this.copyText = { queryDetails: data.queryDetails, parsedQueryDetails: data.parsedQueryDetails, renderedQueryTemplate: null }

    el.querySelectorAll(".query-explain-copy").forEach((button) => {
      button.addEventListener("click", () => {
        const text = this.copyText[button.dataset.tab]
        if (text) copyText(text).catch(() => {})
      })
    })

    TABS.forEach((tab) => {
      el.querySelector(`#${tab.tabId}`).addEventListener("shown.bs.tab", () => {
        this.toggledPanel = tab.key
        el.querySelectorAll(".query-explain-copy").forEach((button) => {
          button.classList.toggle("d-none", button.dataset.tab !== tab.key)
        })
      })
    })

    const templateTab = el.querySelector("#query-explain-tab-template")
    const templatePane = el.querySelector(".query-explain-template")
    templatePane.innerHTML = "<p>This is not a templated query.</p>"

    if (data.supportsTemplate) {
      templateTab.addEventListener("shown.bs.tab", () => this.requestTemplate(templatePane))
    }
  }

  requestTemplate(templatePane) {
    templatePane.innerHTML = "<p>Rendering query template&hellip;</p>"

    const onResult = (event) => {
      this.element.removeEventListener("query-explain:template-rendered", onResult)
      this.renderTemplateResult(templatePane, event.detail)
    }
    this.element.addEventListener("query-explain:template-rendered", onResult)
    this.element.dispatchEvent(new CustomEvent("query-explain:render-template", { bubbles: true }))
  }

  renderTemplateResult(templatePane, detail) {
    if (detail.error) {
      templatePane.innerHTML = `<p class="bg-warning text-warning-emphasis p-3"><i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i> Unable to render the query template.</p>`
      return
    }

    if (!detail.isTemplatedQuery) {
      templatePane.innerHTML = "<p>This is not a templated query.</p>"
      return
    }

    this.copyText.renderedQueryTemplate = detail.renderedQueryTemplate
    templatePane.innerHTML = `
      <p>This is what the populated query template looks like</p>
      <pre class="query-explain-template-json"></pre>
    `
    templatePane.querySelector(".query-explain-template-json").textContent = detail.renderedQueryTemplate
  }
}
