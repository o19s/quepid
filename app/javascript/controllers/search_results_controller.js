import { Controller } from "@hotwired/stimulus"
import { queryDocumentsStore } from "stores/query_documents_store"
import { openDetailedDocumentModal } from "utils/detailed_document_modal"
import { copyText } from "utils/clipboard"

/**
 * Renders an expanded query from the plain document read model. Angular still
 * owns live search and mutations, but those are reached through explicit
 * command/state adapters rather than scope discovery.
 */
export default class extends Controller {
  static targets = ["content", "results", "notesBox"]

  connect() {
    this.store = window.quepidStore?.documents || queryDocumentsStore
    this.storeChange = event => this.renderFromStore(event.detail)
    this.store.addEventListener("change", this.storeChange)
    this.store.addEventListener("reset", this.storeChange)
    this.ratingHandler = event => this.handleRating(event)
    this.showDocumentHandler = event => this.handleShowDocument(event)
    this.element.addEventListener("rating-popover:rate", this.ratingHandler)
    this.element.addEventListener("rating-popover:reset", this.ratingHandler)
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
    const docId = result?.__searchResultDocument?.id
    const rating = event.type === "rating-popover:rate" ? parseInt(event.detail.rating, 10) : null
    window.quepidSearch?.queryState?.rateDocument?.(this.queryId, docId, rating)
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
    const linkUrl = window.quepidSearch?.queryState?.documentUrl?.(this.queryId, docId)
    openDetailedDocumentModal({ doc: snapshotDoc, linkUrl })
  }
}
