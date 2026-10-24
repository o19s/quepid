import { Controller } from "@hotwired/stimulus"
import { copyText } from "utils/clipboard"
import { createTemporaryFeedback } from "utils/temporary_feedback"
import { openDynamicModal } from "utils/dynamic_modal"
import { renderJsonExplorer } from "utils/json_explorer"

const TABS = [
  { key: "queryDetails", tabId: "query-explain-tab-params", paneId: "query-explain-pane-params" },
  { key: "parsedQueryDetails", tabId: "query-explain-tab-parsing", paneId: "query-explain-pane-parsing" },
  { key: "renderedQueryTemplate", tabId: "query-explain-tab-template", paneId: "query-explain-pane-template" }
]
const COPY_FEEDBACK_MS = 2000

/**
 * "Explain Query" modal on the per-query toolbar.
 *
 * Params/Parsing tab data is read from the `queries-list` outlet when the modal
 * opens, so it reflects the query's latest search.
 * The Query Template tab needs a live network call
 * (`query.searcher.renderTemplate()`, ES/OS-only) that still runs through the
 * live searcher, so it's awaited from `queriesListOutlet.renderQueryTemplate()`.
 * Re-requested every time the tab is shown.
 */
export default class extends Controller {
  static targets = ["params", "paramsMessage", "paramsMessageText", "paramsWarningIcon", "parsing", "templatePane", "tab", "copy"]
  static outlets = ["queries-list"]
  static values = { queryId: Number, modalRoot: Boolean }

  connect() {
    if (this.modalRootValue) {
      this.lifecycle = {}
      this.listeners = []
      this.feedback = []
      this.listen(this.element.closest(".modal"), "hide.bs.modal", () => this.cleanup())
      this.wireModal(this.element.queryExplainData)
      return
    }
  }

  requestOpen() {
    this.open(this.queriesListOutlet.explainData(this.queryIdValue))
  }

  open(data) {
    this.toggledPanel = "queryDetails"

    const modal = openDynamicModal({
      templateId: "query-explain-modal-template",
      size: "lg",
      ariaLabelledBy: "query-explain-modal-title"
    })

    const content = modal.element.querySelector(".modal-content")
    content.dataset.controller = "query-explain"
    content.dataset.queryExplainModalRootValue = "true"
    content.dataset.queryExplainQueryIdValue = String(this.queryIdValue)
    content.dataset.queryExplainQueriesListOutlet = this.element.dataset.queryExplainQueriesListOutlet
    content.queryExplainData = data
  }

  disconnect() {
    this.cleanup()
  }

  listen(element, event, handler) {
    element.addEventListener(event, handler)
    this.listeners.push(() => element.removeEventListener(event, handler))
  }

  cleanup() {
    this.lifecycle = null
    this.templateRequest = null
    this.listeners?.forEach(remove => remove())
    this.listeners = []
    this.feedback?.forEach(cancel => cancel())
    this.feedback = []
    this.tabTargets.forEach(element => {
      window.bootstrap?.Tab?.getInstance(element)?.dispose()
    })
  }

  wireModal(data) {
    if (!data.queryDetailsMessage) {
      renderJsonExplorer(this.paramsTarget, data.queryDetails, { collapsed: false })
    }
    const paramsMessage = this.paramsMessageTarget
    const paramsMessageText = this.paramsMessageTextTarget
    const hasMessage = Boolean(data.queryDetailsMessage)
    paramsMessageText.textContent = data.queryDetailsMessage || "These are the query parameters processed by the search engine."
    this.paramsWarningIconTarget.classList.toggle("d-none", !hasMessage)
    paramsMessage.classList.toggle("bg-warning", hasMessage)
    paramsMessage.classList.toggle("text-warning-emphasis", hasMessage)
    paramsMessage.classList.toggle("p-3", hasMessage)
    renderJsonExplorer(this.parsingTarget, data.parsedQueryDetails, { collapsed: false })

    this.copyValues = { queryDetails: data.queryDetails, parsedQueryDetails: data.parsedQueryDetails, renderedQueryTemplate: null }

    this.copyFeedback = new WeakMap()
    this.copyTargets.forEach((button) => {
      const label = [...button.childNodes].map((node) => node.cloneNode(true))
      const feedback = createTemporaryFeedback(COPY_FEEDBACK_MS)
      this.feedback.push(() => {
        feedback.cancel()
        button.replaceChildren(...label.map(node => node.cloneNode(true)))
      })
      const showFeedback = (iconClass, text) => {
        const icon = document.createElement("i")
        icon.className = `bi ${iconClass}`
        feedback.show(
          () => button.replaceChildren(icon, ` ${text}`),
          () => button.replaceChildren(...label)
        )
      }

      this.copyFeedback.set(button, showFeedback)
    })

    this.supportsTemplate = data.supportsTemplate
    this.templatePaneTarget.replaceChildren(Object.assign(document.createElement("p"), { textContent: "This is not a templated query." }))
  }

  copy(event) {
    const lifecycle = this.lifecycle
    if (!lifecycle) return
    const button = event.currentTarget
    const text = this.copyValues[button.dataset.tab]
    if (!text) return
    const showFeedback = this.copyFeedback.get(button)
    copyText(text).then(
      () => { if (lifecycle === this.lifecycle) showFeedback("bi-check-lg", "Copied!") },
      () => { if (lifecycle === this.lifecycle) showFeedback("bi-exclamation-triangle", "Copy failed") }
    )
  }

  tabShown(event) {
    if (!this.lifecycle) return
    const tab = TABS.find(tab => tab.tabId === event.currentTarget.id)
    this.toggledPanel = tab.key
    this.copyTargets.forEach(button => {
      button.classList.toggle("d-none", button.dataset.tab !== tab.key)
    })
    if (tab.key === "renderedQueryTemplate" && this.supportsTemplate) {
      this.requestTemplate(this.templatePaneTarget)
    }
  }

  async requestTemplate(templatePane) {
    const lifecycle = this.lifecycle
    if (!lifecycle) return
    const request = {}
    this.templateRequest = request
    templatePane.replaceChildren(Object.assign(document.createElement("p"), { textContent: "Rendering query template…" }))

    let result
    try {
      result = await this.queriesListOutlet.renderQueryTemplate(this.queryIdValue)
    } catch (error) {
      console.error("query-explain: render template failed", error)
      result = { error: true }
    }
    if (!lifecycle || lifecycle !== this.lifecycle || request !== this.templateRequest) return
    this.renderTemplateResult(templatePane, result)
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

    this.copyValues.renderedQueryTemplate = detail.renderedQueryTemplate
    const message = document.createElement("p")
    message.textContent = "This is what the populated query template looks like"
    const value = document.createElement("pre")
    value.className = "query-explain-template-json"
    value.textContent = detail.renderedQueryTemplate
    templatePane.replaceChildren(message, value)
  }
}
