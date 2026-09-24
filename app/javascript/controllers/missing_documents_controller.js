import { Controller } from "@hotwired/stimulus"
import { openDynamicModal } from "utils/dynamic_modal"
import { snapshotDocument } from "stores/query_documents_store"

export default class extends Controller {
  static targets = ["queryParams", "queryParamsEditor", "searchButton", "resetButton", "status", "results", "next", "spinner", "engineName"]
  static values = { queryId: Number }

  open(event) {
    event.preventDefault()
    const modal = openDynamicModal({
      size: "lg",
      ariaLabelledBy: "missing-documents-modal-title",
      html: `
        <div class="modal-header">
          <h3 class="modal-title" id="missing-documents-modal-title">Find and Rate Missing Documents</h3>
          <button type="button" class="btn-core-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body" data-controller="missing-documents" data-missing-documents-modal-root="true" data-missing-documents-query-id-value="${this.queryIdValue}"></div>
        <div class="modal-footer"><button class="btn btn-outline-secondary" data-bs-dismiss="modal">Close</button></div>
      `
    })
    modal.element.querySelector("[data-controller='missing-documents']").missingDocumentsModal = modal
  }

  connect() {
    if (!this.isModalRoot) return
    this.adapter = window.quepidSearch?.targetedSearch?.(this.queryIdValue)
    if (!this.adapter) return
    this.element.addEventListener("rating-popover:rate", this.ratingHandler = event => this.rate(event))
    this.element.addEventListener("rating-popover:reset", this.resetHandler = event => this.rate(event))
    this.renderShell()
    this.adapter.resetToRated().then(() => this.render())
  }

  get isModalRoot() {
    return this.element.dataset.missingDocumentsModalRoot === "true"
  }

  disconnect() {
    this.element.removeEventListener("rating-popover:rate", this.ratingHandler)
    this.element.removeEventListener("rating-popover:reset", this.resetHandler)
    this.editor?.destroy()
  }

  renderShell() {
    const supported = this.adapter.usesQueryParamsEditor
    const jsonEditor = supported && ["es", "os"].includes(this.adapter.settings?.searchEngine)
    const queryEditor = jsonEditor
      ? `<textarea class="form-control d-none" rows="4" data-missing-documents-target="queryParams"></textarea><div id="missing-documents-query-params-editor" class="es-query-params os-query-params" data-missing-documents-target="queryParamsEditor"></div>`
      : `<textarea class="form-control" rows="4" data-missing-documents-target="queryParams"></textarea>`
    this.element.innerHTML = `
      ${supported ? `
        <p>Often you know that a document is a good match for a query, but it doesn't match the current query. This lets you find that document and give it a grade, which then influences your scorer.</p>
        <form data-action="submit->missing-documents#search">
          <div class="row">
            <div class="mb-3 col-sm-6">${queryEditor}<p class="form-text">This is pre-filled from your current try's query. Edit it however you like; it won't change your saved try.</p></div>
            <div class="col-sm-3"><input type="submit" class="btn btn-primary form-control" value="Search" data-missing-documents-target="searchButton"></div>
          </div>
        </form>
        <button type="button" class="btn btn-outline-secondary form-control mb-3" data-missing-documents-target="resetButton" data-action="missing-documents#reset">Reset to All Rated Docs</button>
      ` : `<div class="alert alert-warning">Finding and rating missing documents isn't supported for the <strong data-missing-documents-target="engineName"></strong> search engine yet.</div>`}
      <div data-missing-documents-target="status"></div>
      <div data-missing-documents-target="results"></div>
      <div class="row paging-row"><button type="button" class="btn btn-outline-secondary d-none" data-missing-documents-target="next" data-action="missing-documents#paginate">Peek at the next page of results</button><span class="ms-2 d-none" data-missing-documents-target="spinner"><i class="bi bi-arrow-repeat spintime"></i></span></div>
    `
    const engineNameTarget = this.element.querySelector("[data-missing-documents-target='engineName']")
    if (engineNameTarget) engineNameTarget.textContent = this.adapter.engineName
    this.editor = null
    if (jsonEditor && this.hasQueryParamsEditorTarget && window.ace) {
      this.editor = window.ace.edit(this.queryParamsEditorTarget)
      this.editor.setTheme("ace/theme/chrome")
      this.editor.session.setMode("ace/mode/json")
      this.editor.setOptions({
        enableLiveAutocompletion: true,
        enableSnippets: true,
        wrap: true
      })
    } else if (this.hasQueryParamsTarget) {
      this.queryParamsTarget.classList.remove("d-none")
    }
    this.setQueryParams(this.adapter.initialQueryParams() || "")
  }

  get queryParams() {
    return this.editor ? this.editor.getValue() : (this.hasQueryParamsTarget ? this.queryParamsTarget.value : "")
  }

  setQueryParams(value) {
    if (this.editor) {
      this.editor.setValue(value, -1)
    }
    if (this.hasQueryParamsTarget) this.queryParamsTarget.value = value
  }

  async search(event) {
    event.preventDefault()
    await this.run(() => this.adapter.search(this.queryParams))
  }

  async reset() {
    await this.run(() => this.adapter.resetToRated())
    this.setQueryParams(this.adapter.initialQueryParams() || "")
  }

  async paginate(event) {
    event.preventDefault()
    await this.run(() => this.adapter.paginate())
  }

  async run(operation) {
    this.spinnerTarget.classList.remove("d-none")
    this.searchButtonTarget?.setAttribute("disabled", "disabled")
    await operation()
    this.spinnerTarget.classList.add("d-none")
    this.searchButtonTarget?.removeAttribute("disabled")
    this.render()
  }

  rate(event) {
    const rating = event.type === "rating-popover:rate" ? parseInt(event.detail.rating, 10) : null
    if (event.detail?.source === "single-result") {
      const result = event.target.closest("search-result")
      this.adapter.rate(result?.dataset.docId, rating)
    } else {
      this.adapter.rateAll(rating)
    }
    this.render()
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
      engine.textContent = this.adapter.engineName
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
    summary.textContent = this.adapter.defaultList ? `${this.adapter.numFound} rating${this.adapter.numFound === 1 ? "" : "s"} for your original query ${this.adapter.queryText}.` : `${this.adapter.numFound} matching document${this.adapter.numFound === 1 ? "" : "s"}.`
    this.resultsTarget.appendChild(summary)

    const scoreAll = document.createElement("div")
    scoreAll.className = "score-all float-start"
    scoreAll.innerHTML = '<strong>Score All</strong><div class="ratings"><div class="single-rating" data-controller="rating-popover"><span class="btn" style="background-color: rgb(119, 119, 119);">- <i class="bi bi-caret-down-fill"></i></span></div></div>'
    scoreAll.querySelector("[data-controller='rating-popover']").dataset.ratingPopoverScaleValue = JSON.stringify(this.adapter.ratingScale || {})
    this.resultsTarget.appendChild(scoreAll)
    const warning = document.createElement("div")
    warning.className = "alert alert-warning float-start score-all-alert"
    warning.textContent = "Changing ratings will affect the query score."
    this.resultsTarget.appendChild(warning)

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
      result.innerHTML = '<div data-search-result-target="content"></div>'
      this.resultsTarget.appendChild(result)
    })
    this.nextTarget.classList.toggle("d-none", this.adapter.numFound <= this.adapter.docs.length)
  }
}
