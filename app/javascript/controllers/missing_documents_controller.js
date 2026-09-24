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
      templateId: "missing-documents-modal-template"
    })
    const root = modal.element.querySelector("[data-controller='missing-documents']")
    root.dataset.missingDocumentsQueryIdValue = String(this.queryIdValue)
    root.missingDocumentsModal = modal
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
    this.element.replaceChildren(this.missingDocumentsContentTemplate(jsonEditor, supported))
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

  missingDocumentsContentTemplate(jsonEditor, supported) {
    const fragment = document.createDocumentFragment()
    if (supported) {
      const intro = document.createElement("p")
      intro.textContent = "Often you know that a document is a good match for a query, but it doesn't match the current query. This lets you find that document and give it a grade, which then influences your scorer."
      fragment.appendChild(intro)

      const form = document.createElement("form")
      form.dataset.action = "submit->missing-documents#search"
      const row = document.createElement("div")
      row.className = "row"
      const editorColumn = document.createElement("div")
      editorColumn.className = "mb-3 col-sm-6"
      const queryParams = document.createElement("textarea")
      queryParams.className = `form-control${jsonEditor ? " d-none" : ""}`
      queryParams.rows = 4
      queryParams.dataset.missingDocumentsTarget = "queryParams"
      editorColumn.appendChild(queryParams)
      if (jsonEditor) {
        const editor = document.createElement("div")
        editor.id = "missing-documents-query-params-editor"
        editor.className = "es-query-params os-query-params"
        editor.dataset.missingDocumentsTarget = "queryParamsEditor"
        editorColumn.appendChild(editor)
      }
      const hint = document.createElement("p")
      hint.className = "form-text"
      hint.textContent = "This is pre-filled from your current try's query. Edit it however you like; it won't change your saved try."
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
      engineName.textContent = this.adapter.engineName || ""
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
      const content = document.createElement("div")
      content.dataset.searchResultTarget = "content"
      result.appendChild(content)
      this.resultsTarget.appendChild(result)
    })
    this.nextTarget.classList.toggle("d-none", this.adapter.numFound <= this.adapter.docs.length)
  }
}
