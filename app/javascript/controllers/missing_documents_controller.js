import { Controller } from "@hotwired/stimulus"
import { openDynamicModal } from "utils/dynamic_modal"
import { snapshotDocument } from "stores/query_documents_store"
import { getCoreCapabilities } from "utils/core_capability_access"
import { isEsLikeEngine, searchEngineLabel } from "utils/search_engines"
import { fromTextArea } from "modules/editor"
import { withStatusMessages } from "controllers/status_message_behavior"

export default class extends withStatusMessages(Controller) {
  static targets = ["queryParams", "searchButton", "resetButton", "status", "results", "next", "spinner", "engineName", "supported", "unsupported", "solrHelp", "previewHelp"]
  static values = { queryId: Number, modalRoot: Boolean, engineLabels: Object }

  open(event) {
    event.preventDefault()
    const modal = openDynamicModal({
      size: "lg",
      ariaLabelledBy: "missing-documents-modal-title",
      templateId: "missing-documents-modal-template"
    })
    const root = modal.element.querySelector("[data-controller='missing-documents']")
    root.dataset.missingDocumentsQueryIdValue = String(this.queryIdValue)
    root.missingDocumentsModal = modal
  }

  connect() {
    if (!this.isModalRoot) return
    this.disconnected = false
    this.lifecycle = {}
    this.adapter = getCoreCapabilities().targetedSearch?.(this.queryIdValue)
    if (!this.adapter) return
    this.renderShell()
    this.run(() => this.adapter.resetToRated(), "load rated documents")
  }

  get isModalRoot() {
    return this.modalRootValue
  }

  get engineLabel() {
    return searchEngineLabel(this.engineLabelsValue, this.adapter.engineName)
  }

  disconnect() {
    super.disconnect()
    this.disconnected = true
    this.lifecycle = null
    this.busy = false
    this.editor?.destroy()
    this.editor = null
  }

  renderShell() {
    const supported = this.adapter.usesQueryParamsEditor
    const jsonEditor = supported && isEsLikeEngine(this.adapter.settings?.searchEngine)
    const solr = this.adapter.settings?.searchEngine === "solr"
    if (this.hasSolrHelpTarget) this.solrHelpTarget.classList.toggle("d-none", !solr)
    if (this.hasPreviewHelpTarget) this.previewHelpTarget.classList.toggle("d-none", solr)
    this.supportedTarget.classList.toggle("d-none", !supported)
    this.unsupportedTarget.classList.toggle("d-none", supported)
    this.engineNameTarget.textContent = this.engineLabel
    this.queryParamsTarget.disabled = !supported
    this.editor = null
    if (jsonEditor && this.hasQueryParamsTarget) {
      this.editor = fromTextArea(this.queryParamsTarget, { mode: "json", height: 400 })
    }
    this.setQueryParams(this.adapter.initialQueryParams() || "")
  }

  get queryParams() {
    return this.editor ? this.editor.getValue() : (this.hasQueryParamsTarget ? this.queryParamsTarget.value : "")
  }

  setQueryParams(value) {
    if (this.editor) {
      this.editor.setValue(value)
    }
    if (this.hasQueryParamsTarget) this.queryParamsTarget.value = value
  }

  async search(event) {
    event.preventDefault()
    await this.run(() => this.adapter.search(this.queryParams), "search for documents")
  }

  async reset() {
    const lifecycle = this.lifecycle
    const reset = await this.run(() => this.adapter.resetToRated(), "load rated documents")
    if (reset && !this.disconnected && lifecycle === this.lifecycle) {
      this.setQueryParams(this.adapter.initialQueryParams() || "")
    }
  }

  async paginate(event) {
    event.preventDefault()
    await this.run(() => this.adapter.paginate(), "load the next page")
  }

  async run(operation, action = "load documents") {
    if (this.busy || this.disconnected) return false
    const lifecycle = this.lifecycle
    this.busy = true
    this.spinnerTarget.classList.remove("d-none")
    this.setControlsDisabled(true)
    try {
      await operation()
      if (this.disconnected || lifecycle !== this.lifecycle) return false
      this.render()
      return true
    } catch (error) {
      if (this.disconnected || lifecycle !== this.lifecycle) return false
      console.error("missing-documents: operation failed", error)
      const message = document.createElement("div")
      this.showStatusMessage(message, {
        message: `Unable to ${action}. Please try again.`,
        className: "alert alert-danger"
      })
      this.statusTarget.replaceChildren(message)
      return false
    } finally {
      if (!this.disconnected && lifecycle === this.lifecycle) {
        this.busy = false
        this.spinnerTarget.classList.add("d-none")
        this.setControlsDisabled(false)
      }
    }
  }

  setControlsDisabled(disabled) {
    if (this.hasSearchButtonTarget) this.searchButtonTarget.disabled = disabled || !this.adapter.usesQueryParamsEditor
    if (this.hasResetButtonTarget) this.resetButtonTarget.disabled = disabled || !this.adapter.usesQueryParamsEditor || this.adapter.defaultList
    if (this.hasNextTarget) this.nextTarget.disabled = disabled
  }

  async rate(event) {
    const rating = event.type === "rating-popover:rate" ? parseInt(event.detail.rating, 10) : null
    try {
      if (event.detail?.source === "single-result") {
        const result = event.target.closest("search-result")
        await this.adapter.rate(result?.dataset.docId, rating)
      } else {
        await this.adapter.rateAll(rating)
      }
    } finally {
      if (!this.disconnected) this.render()
    }
  }

  render() {
    if (!this.adapter.usesQueryParamsEditor) return
    this.resetButtonTarget?.toggleAttribute("disabled", this.adapter.defaultList)
    this.statusTarget.replaceChildren()
    if (this.adapter.parseError) {
      const message = document.createElement("div")
      message.className = "alert alert-danger"
      message.textContent = "Couldn't parse that query — check the syntax and try again."
      this.statusTarget.appendChild(message)
    } else if (this.adapter.defaultList && this.adapter.ratedDocsLookupUnsupported) {
      const message = document.createElement("div")
      message.className = "alert alert-warning"
      message.append("There are ", String(this.adapter.totalRatings), " ratings for your original query, but looking up already-rated documents by ID isn't supported for the ")
      const engine = document.createElement("strong")
      engine.textContent = this.engineLabel
      message.append(engine, " search engine.")
      this.statusTarget.appendChild(message)
    } else if (!this.adapter.defaultList && this.adapter.numFound === 0) {
      const message = document.createElement("div")
      message.className = "alert alert-warning"
      message.append("Your query ")
      const query = document.createElement("em")
      query.textContent = this.adapter.lastQuery || this.adapter.queryText
      message.append(query, " returned no results")
      this.statusTarget.appendChild(message)
    }

    this.resultsTarget.replaceChildren()
    if (this.adapter.docs.length === 0) return
    const heading = document.createElement("h4")
    heading.textContent = this.adapter.defaultList ? "Already Rated Documents" : "Query Results"
    this.resultsTarget.appendChild(heading)
    const summary = document.createElement("p")
    if (this.adapter.defaultList) {
      const count = this.adapter.numFound
      const lead = count === 0 ? "There are no ratings created yet" : count === 1 ? "There is one rating" : `There are ${count} ratings`
      summary.append(`${lead} for your original query `, Object.assign(document.createElement("em"), { textContent: this.adapter.queryText }), ".")
    } else {
      summary.textContent = `${this.adapter.numFound} matching document${this.adapter.numFound === 1 ? "" : "s"}.`
    }
    this.resultsTarget.appendChild(summary)

    const scoreAll = document.createElement("div")
    scoreAll.className = "score-all float-start"
    const scoreLabel = document.createElement("strong")
    scoreLabel.textContent = "Score All"
    const ratings = document.createElement("div")
    ratings.className = "ratings"
    const rating = document.createElement("div")
    rating.className = "single-rating"
    rating.dataset.controller = "rating-popover"
    rating.dataset.ratingPopoverScaleValue = JSON.stringify(this.adapter.ratingScale || {})
    const ratingButton = document.createElement("span")
    ratingButton.className = "btn"
    ratingButton.style.backgroundColor = "rgb(119, 119, 119)"
    ratingButton.append("- ")
    const ratingIcon = document.createElement("i")
    ratingIcon.className = "bi bi-caret-down-fill"
    ratingButton.appendChild(ratingIcon)
    rating.appendChild(ratingButton)
    ratings.appendChild(rating)
    scoreAll.append(scoreLabel, ratings)
    const warning = document.createElement("div")
    warning.className = "alert alert-warning float-start score-all-alert"
    warning.textContent = "Changing ratings will affect the query score."
    // Contain the two floats so the results below start on their own full-width line.
    const scoreAllRow = document.createElement("div")
    scoreAllRow.className = "clearfix"
    scoreAllRow.append(scoreAll, warning)
    this.resultsTarget.appendChild(scoreAllRow)

    this.adapter.docs.forEach((doc, index) => {
      const result = document.createElement("search-result")
      result.className = "search-result"
      result.dataset.controller = "search-result"
      result.dataset.searchResultExplainViewValue = "full"
      result.dataset.docId = String(doc.id)
      result.setAttribute("rank", String(index + 1))
      const maxDocScore = this.adapter.query.maxDocScore?.() || null
      result.__searchResultDocument = snapshotDocument(doc, { maxDocScore })
      result.__searchResultQuery = { ratingScale: this.adapter.ratingScale || {}, maxDocScore }
      const content = document.createElement("div")
      content.dataset.searchResultTarget = "content"
      result.appendChild(content)
      this.resultsTarget.appendChild(result)
    })
    this.nextTarget.classList.toggle("d-none", this.adapter.numFound <= this.adapter.docs.length)
  }
}
