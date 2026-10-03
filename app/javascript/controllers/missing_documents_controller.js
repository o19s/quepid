import { Controller } from "@hotwired/stimulus"
import { openDynamicModal } from "utils/dynamic_modal"
import { snapshotDocument } from "stores/query_documents_store"
import { getCoreCapabilities } from "utils/core_capability_access"
import { isEsLikeEngine, searchEngineLabel } from "utils/search_engines"
import { fromTextArea } from "modules/editor"

export default class extends Controller {
  static targets = ["queryParams", "searchButton", "resetButton", "status", "results", "next", "spinner", "engineName"]
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
    this.adapter = getCoreCapabilities().targetedSearch?.(this.queryIdValue)
    if (!this.adapter) return
    this.renderShell()
    this.adapter.resetToRated().then(() => this.render())
  }

  get isModalRoot() {
    return this.modalRootValue
  }

  get engineLabel() {
    return searchEngineLabel(this.engineLabelsValue, this.adapter.engineName)
  }

  disconnect() {
    this.editor?.view?.destroy()
  }

  renderShell() {
    const supported = this.adapter.usesQueryParamsEditor
    const jsonEditor = supported && isEsLikeEngine(this.adapter.settings?.searchEngine)
    this.element.replaceChildren(this.missingDocumentsContentTemplate(jsonEditor, supported))
    this.editor = null
    if (jsonEditor && this.hasQueryParamsTarget) {
      this.editor = fromTextArea(this.queryParamsTarget, { mode: "json", height: 400 })
    }
    this.setQueryParams(this.adapter.initialQueryParams() || "")
  }

  missingDocumentsContentTemplate(jsonEditor, supported) {
    const fragment = document.createDocumentFragment()
    if (supported) {
      const intro = document.createElement("p")
      const code = text => Object.assign(document.createElement("code"), { textContent: text })
      intro.append(
        "Often you know that a document is a good match for a query, but it doesn't match the current query. This lets you find that document and give it a grade, which then influences your scorer. For example, NDCG is based on your global scores, so if your top 10 are all ",
        code("1"), "'s, and you find and rate a document as a ", code("3"),
        ", then the score will drop if that ", code("3"), " rated document doesn't show up first!"
      )
      fragment.appendChild(intro)

      const form = document.createElement("form")
      form.dataset.action = "submit->missing-documents#search"
      const row = document.createElement("div")
      row.className = "row"
      const editorColumn = document.createElement("div")
      editorColumn.className = "mb-3 col-sm-6"
      const queryParams = document.createElement("textarea")
      queryParams.className = "form-control"
      queryParams.rows = 4
      queryParams.dataset.missingDocumentsTarget = "queryParams"
      editorColumn.appendChild(queryParams)
      const hint = document.createElement("p")
      hint.className = "form-text"
      hint.textContent = "This is pre-filled from your current try's query, just like the Query Sandbox \u2014 edit it however you like to search for a document to rate. It's a one-off query and won't change your try's saved query."
      editorColumn.appendChild(hint)
      row.appendChild(editorColumn)
      const searchColumn = document.createElement("div")
      searchColumn.className = "col-sm-3"
      const search = document.createElement("input")
      search.type = "submit"
      search.className = "btn btn-primary form-control"
      search.value = "Search"
      search.dataset.missingDocumentsTarget = "searchButton"
      searchColumn.appendChild(search)
      row.appendChild(searchColumn)
      form.appendChild(row)
      fragment.appendChild(form)
      const reset = document.createElement("button")
      reset.type = "button"
      reset.className = "btn btn-outline-secondary form-control mb-3"
      reset.dataset.missingDocumentsTarget = "resetButton"
      reset.dataset.action = "missing-documents#reset"
      reset.textContent = "Reset to All Rated Docs"
      fragment.appendChild(reset)
    } else {
      const warning = document.createElement("div")
      warning.className = "alert alert-warning"
      const engineName = document.createElement("strong")
      engineName.dataset.missingDocumentsTarget = "engineName"
      engineName.textContent = this.engineLabel
      warning.append("Finding and rating missing documents isn't supported for the ", engineName, " search engine yet.")
      fragment.appendChild(warning)
    }
    const status = document.createElement("div")
    status.dataset.missingDocumentsTarget = "status"
    const results = document.createElement("div")
    results.dataset.missingDocumentsTarget = "results"
    fragment.append(status, results)
    const paging = document.createElement("div")
    paging.className = "row paging-row"
    const next = document.createElement("button")
    next.type = "button"
    next.className = "btn btn-outline-secondary d-none"
    next.dataset.missingDocumentsTarget = "next"
    next.dataset.action = "missing-documents#paginate"
    next.textContent = "Peek at the next page of results"
    const spinner = document.createElement("span")
    spinner.className = "ms-2 d-none"
    spinner.dataset.missingDocumentsTarget = "spinner"
    const spinnerIcon = document.createElement("i")
    spinnerIcon.className = "bi bi-arrow-repeat spintime"
    spinner.appendChild(spinnerIcon)
    paging.append(next, spinner)
    fragment.appendChild(paging)
    return fragment
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
      this.render()
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
