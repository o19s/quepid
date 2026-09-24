import { Controller } from "@hotwired/stimulus"
import { copyText } from "utils/clipboard"
import { openDynamicModal } from "utils/dynamic_modal"
import { renderJsonExplorer } from "utils/json_explorer"

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
    const button = document.createElement("button")
    button.type = "button"
    button.className = "btn btn-outline-secondary btn-sm"
    button.textContent = "Explain Query"
    this.element.replaceChildren(button)
    button.addEventListener("click", () => {
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
      templateId: "query-explain-modal-template",
      size: "lg",
      ariaLabelledBy: "query-explain-modal-title"
    })

    this.wireModal(modal.element, data)
  }

  wireModal(el, data) {
    if (!data.queryDetailsMessage) {
      renderJsonExplorer(el.querySelector(".query-explain-params"), data.queryDetails, { collapsed: false })
    }
    const paramsMessage = el.querySelector("[data-modal-target='paramsMessage']")
    const paramsMessageText = el.querySelector("[data-modal-target='paramsMessageText']")
    const hasMessage = Boolean(data.queryDetailsMessage)
    paramsMessageText.textContent = data.queryDetailsMessage || "These are the query parameters processed by the search engine."
    paramsMessage.querySelector("[data-modal-target='paramsWarningIcon']").classList.toggle("d-none", !hasMessage)
    paramsMessage.classList.toggle("bg-warning", hasMessage)
    paramsMessage.classList.toggle("text-warning-emphasis", hasMessage)
    paramsMessage.classList.toggle("p-3", hasMessage)
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
    templatePane.querySelector("[data-modal-target='templateMessage']").textContent = "This is not a templated query."

    if (data.supportsTemplate) {
      templateTab.addEventListener("shown.bs.tab", () => this.requestTemplate(templatePane))
    }
  }

  requestTemplate(templatePane) {
    templatePane.replaceChildren(Object.assign(document.createElement("p"), { textContent: "Rendering query template…" }))

    const onResult = (event) => {
      this.element.removeEventListener("query-explain:template-rendered", onResult)
      this.renderTemplateResult(templatePane, event.detail)
    }
    this.element.addEventListener("query-explain:template-rendered", onResult)
    this.element.dispatchEvent(new CustomEvent("query-explain:render-template", { bubbles: true }))
  }

  renderTemplateResult(templatePane, detail) {
    if (detail.error) {
      const message = document.createElement("p")
      message.className = "bg-warning text-warning-emphasis p-3"
      message.textContent = "Unable to render the query template."
      templatePane.replaceChildren(message)
      return
    }

    if (!detail.isTemplatedQuery) {
      const message = document.createElement("p")
      message.textContent = "This is not a templated query."
      templatePane.replaceChildren(message)
      return
    }

    this.copyText.renderedQueryTemplate = detail.renderedQueryTemplate
    const message = document.createElement("p")
    message.textContent = "This is what the populated query template looks like"
    const value = document.createElement("pre")
    value.className = "query-explain-template-json"
    value.textContent = detail.renderedQueryTemplate
    templatePane.replaceChildren(message, value)
  }
}
