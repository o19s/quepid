import { Controller } from "@hotwired/stimulus"
import { queryDocumentsStore } from "stores/query_documents_store"
import { openDetailedDocumentModal } from "utils/detailed_document_modal"
import { copyText } from "utils/clipboard"
import { sanitizeHtml } from "controllers/search_result_controller"

/**
 * Renders an expanded query from the plain document read model. Angular still
 * owns live search and mutations, but those are reached through explicit
 * command/state adapters rather than scope discovery.
 */
export default class extends Controller {
  static targets = [
    "content", "results", "notesBox", "scoreAll", "error", "footer", "nextPage",
    "deferredTools", "depthNote", "depthValue", "ratedNote"
  ]

  connect() {
    this.store = window.quepidStore?.documents || queryDocumentsStore
    this.storeChange = event => this.renderFromStore(event.detail)
    this.store.addEventListener("change", this.storeChange)
    this.store.addEventListener("reset", this.storeChange)
    this.ratingHandler = event => this.handleRating(event)
    this.queryToggleHandler = event => this.handleQueryToggle(event)
    this.showDocumentHandler = event => this.handleShowDocument(event)
    this.element.addEventListener("rating-popover:rate", this.ratingHandler)
    this.element.addEventListener("rating-popover:reset", this.ratingHandler)
    this.element.addEventListener("query-row:toggle", this.queryToggleHandler)
    this.element.addEventListener("search-result:show-document", this.showDocumentHandler)
    this.notesCloseHandler = () => this.setNotesOpen(false)
    this.element.addEventListener("query-notes:close", this.notesCloseHandler)
    this.render()
  }

  disconnect() {
    this.store?.removeEventListener("change", this.storeChange)
    this.store?.removeEventListener("reset", this.storeChange)
    this.element.removeEventListener("rating-popover:rate", this.ratingHandler)
    this.element.removeEventListener("rating-popover:reset", this.ratingHandler)
    this.element.removeEventListener("query-row:toggle", this.queryToggleHandler)
    this.element.removeEventListener("search-result:show-document", this.showDocumentHandler)
    this.element.removeEventListener("query-notes:close", this.notesCloseHandler)
  }

  renderFromStore(detail) {
    if (!detail || detail.queryId == null || String(detail.queryId) === String(this.queryId)) this.render()
  }

  render() {
    if (!this.hasContentTarget || !this.hasResultsTarget) return

    const snapshot = this.store.query(this.queryId)
    if (!snapshot) {
      this.contentTarget.classList.add("d-none")
      this.resultsTarget.replaceChildren()
      return
    }

    const expanded = snapshot.expanded === true
    this.contentTarget.classList.toggle("d-none", !expanded)
    this.renderNotes(snapshot)
    this.renderScoreAll(snapshot)
    this.renderState(snapshot)

    if (!expanded || !this.isResultsView()) {
      this.resultsTarget.replaceChildren()
      return
    }

    this.renderDocuments(this.visibleDocuments(snapshot), snapshot)
  }

  get queryId() {
    return this.element.closest("[data-query-row-query-id-value]")?.dataset.queryRowQueryIdValue || this.element.dataset.queryId
  }

  visibleDocuments(snapshot) {
    return snapshot.showOnlyRated ? snapshot.ratedDocs || [] : snapshot.docs || []
  }

  isResultsView() {
    const snapshot = this.store.query(this.queryId)
    return !snapshot?.resultsView || snapshot.resultsView === "results" || snapshot.resultsView === 2
  }

  renderState(snapshot) {
    const resultsVisible = snapshot?.resultsView === undefined || snapshot.resultsView === "results" || snapshot.resultsView === 2
    const showOnlyRated = snapshot?.showOnlyRated === true
    const hasError = Boolean(snapshot?.errorText)

    if (this.hasErrorTarget) {
      this.errorTarget.innerHTML = sanitizeHtml(snapshot?.errorText || "")
      this.errorTarget.classList.toggle("d-none", !hasError)
    }
    if (this.hasFooterTarget) this.footerTarget.classList.toggle("d-none", !resultsVisible)
    if (this.hasNextPageTarget) {
      this.nextPageTarget.classList.toggle("d-none", !resultsVisible || !this.canPaginate(snapshot))
    }
    if (this.hasDepthNoteTarget) {
      const showDepth = resultsVisible && !showOnlyRated && Boolean(snapshot?.depthOfRating)
      this.depthNoteTarget.classList.toggle("d-none", !showDepth)
      if (showDepth && this.hasDepthValueTarget) this.depthValueTarget.textContent = String(snapshot.depthOfRating)
    }
    if (this.hasRatedNoteTarget) this.ratedNoteTarget.classList.toggle("d-none", !resultsVisible || !showOnlyRated)
  }

  canPaginate(snapshot) {
    const found = snapshot?.showOnlyRated ? snapshot.ratedDocsFound : snapshot?.numFound
    const loaded = this.visibleDocuments(snapshot).length
    return Number(found || 0) > loaded && snapshot?.paginationSupported !== false
  }

  paginate(event) {
    event.preventDefault()
    window.quepidSearch?.queryState?.paginateQuery?.(this.queryId, this.store.query(this.queryId)?.showOnlyRated === true)
  }

  collapse(event) {
    event.preventDefault()
    window.quepidSearch?.queryState?.toggleQuery?.(this.queryId)
  }

  copyQuery(event) {
    event.preventDefault()
    const snapshot = this.store.query(this.queryId)
    if (snapshot?.queryText) copyText(snapshot.queryText).catch(() => {})
  }

  toggleNotes(event) {
    event.preventDefault()
    const snapshot = this.store.query(this.queryId)
    this.setNotesOpen(snapshot?.notes !== true)
  }

  setNotesOpen(open) {
    this.store.updateQueryState(this.queryId, { notes: Boolean(open) })
    if (open && this.hasNotesBoxTarget) {
      this.notesBoxTarget.querySelector('[data-controller~="query-notes"]')?.dispatchEvent(
        new CustomEvent("query-notes:open")
      )
    }
  }

  renderNotes(snapshot) {
    if (this.hasNotesBoxTarget) this.notesBoxTarget.classList.toggle("d-none", snapshot?.notes !== true)
  }

  renderDocuments(docs, snapshot) {
    const fragment = document.createDocumentFragment()

    docs.forEach((doc, index) => {
      const element = document.createElement("search-result")
      element.className = "search-result"
      element.setAttribute("data-controller", "search-result")
      element.setAttribute("data-search-result-explain-view-value", "full")
      element.setAttribute("rank", String(index + 1))
      element.dataset.queryId = String(snapshot.queryId)
      element.dataset.docId = String(doc.id)
      element.dataset.rating = doc.rating == null ? "" : String(doc.rating)
      element.innerHTML = '<div data-search-result-target="content"></div>'
      element.__searchResultDocument = doc
      element.__searchResultQuery = snapshot
      fragment.appendChild(element)
    })

    this.resultsTarget.replaceChildren(fragment)
  }

  handleRating(event) {
    event.stopPropagation()
    const snapshot = this.store.query(this.queryId)
    if (!snapshot) return

    const result = event.target.closest("search-result")
    if (!result) {
      const rating = event.type === "rating-popover:rate" ? parseInt(event.detail.rating, 10) : null
      window.quepidSearch?.queryState?.rateAll?.(this.queryId, rating)
      return
    }
    const docId = result?.__searchResultDocument?.id
    const rating = event.type === "rating-popover:rate" ? parseInt(event.detail.rating, 10) : null
    window.quepidSearch?.queryState?.rateDocument?.(this.queryId, docId, rating)
  }

  renderScoreAll(snapshot) {
    if (!this.hasScoreAllTarget) return

    this.scoreAllTarget.replaceChildren()
    const container = document.createElement("div")
    container.className = "col-ratings query-rating"
    container.innerHTML = `
      <strong>Score All</strong>
      <div class="ratings"><div class="single-rating" data-controller="rating-popover"></div></div>
    `

    const popover = container.querySelector('[data-controller="rating-popover"]')
    popover.dataset.ratingPopoverScaleValue = JSON.stringify(snapshot.ratingScale || {})
    const trigger = document.createElement("span")
    trigger.className = "btn"
    const rating = snapshot.queryRating || "--"
    trigger.textContent = `${rating} `
    trigger.style.backgroundColor = this.ratingColor(rating, snapshot.ratingScale || {})
    const icon = document.createElement("i")
    icon.className = "bi bi-caret-down-fill"
    icon.setAttribute("aria-hidden", "true")
    trigger.appendChild(icon)
    popover.appendChild(trigger)
    this.scoreAllTarget.appendChild(container)
  }

  ratingColor(rating, scale) {
    return window.quepidSearch?.scoring?.ratingBackgroundColor?.({ rating, scale })?.["background-color"] || scale[rating]?.color || ""
  }

  handleQueryToggle(event) {
    event.preventDefault()
    event.stopPropagation()
    window.quepidSearch?.queryState?.toggleQuery?.(this.queryId)
  }

  handleShowDocument(event) {
    event.preventDefault()
    event.stopPropagation()
    const docId = event.detail?.docId
    const snapshot = this.store.query(this.queryId)
    const snapshotDoc = [...(snapshot?.docs || []), ...(snapshot?.ratedDocs || [])].find(
      item => String(item.id) === String(docId)
    )
    if (!snapshotDoc) return
    openDetailedDocumentModal({ doc: snapshotDoc, linkUrl: snapshotDoc.linkUrl })
  }
}
