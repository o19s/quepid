import { Controller } from "@hotwired/stimulus"
import { queryDocumentsStore } from "stores/query_documents_store"

/**
 * Renders an expanded query from the plain document read model. Angular still
 * owns live search and mutations, but it is used here only as an explicit
 * command/state adapter while that seam is being migrated.
 */
export default class extends Controller {
  static targets = ["content", "results"]

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
    this.attachToAngularScope()
  }

  attachToAngularScope() {
    const angularElement = window.angular?.element(this.element)
    this.angularScope = angularElement?.isolateScope?.() || angularElement?.scope?.()
    if (!this.angularScope) {
      this.retryHandle = requestAnimationFrame(() => this.attachToAngularScope())
      return
    }

    this.watchHandle = this.angularScope.$watch(
      () => this.renderStateKey(),
      () => this.render()
    )
    this.render()
  }

  disconnect() {
    if (this.retryHandle) cancelAnimationFrame(this.retryHandle)
    if (this.watchHandle) this.watchHandle()
    this.store?.removeEventListener("change", this.storeChange)
    this.store?.removeEventListener("reset", this.storeChange)
    this.element.removeEventListener("rating-popover:rate", this.ratingHandler)
    this.element.removeEventListener("rating-popover:reset", this.ratingHandler)
    this.element.removeEventListener("search-result:show-document", this.showDocumentHandler)
    this.angularScope = null
  }

  renderStateKey() {
    const query = this.angularScope?.query
    if (!query) return ""
    return [query.isToggled?.(), this.angularScope.displayed?.results, this.angularScope.queriesSvc?.showOnlyRated].join(":")
  }

  renderFromStore(detail) {
    if (!this.angularScope) return
    if (!detail || detail.queryId == null || detail.queryId === this.angularScope.query?.queryId) this.render()
  }

  render() {
    if (!this.angularScope || !this.hasContentTarget || !this.hasResultsTarget) return

    const query = this.angularScope.query
    const snapshot = query && this.store.query(query.queryId)
    if (!query || !snapshot) {
      this.contentTarget.classList.add("d-none")
      this.resultsTarget.replaceChildren()
      return
    }

    const expanded = query.isToggled?.() === true
    this.contentTarget.classList.toggle("d-none", !expanded)

    if (!expanded || !this.isResultsView()) {
      this.resultsTarget.replaceChildren()
      return
    }

    this.renderDocuments(this.visibleDocuments(snapshot), snapshot)
  }

  visibleDocuments(snapshot) {
    return this.angularScope.queriesSvc?.showOnlyRated ? snapshot.ratedDocs || [] : snapshot.docs || []
  }

  isResultsView() {
    const displayed = this.angularScope.displayed
    return !displayed || displayed.results === displayed.resultsView?.results
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
    const query = this.angularScope?.query
    const snapshot = query && this.store.query(query.queryId)
    if (!query || !snapshot) return

    const result = event.target.closest("search-result")
    const docId = result?.__searchResultDocument?.id
    const doc = this.liveDocuments(query).find(candidate => String(candidate.id) === String(docId))
    if (!doc) return

    this.angularScope.$apply(() => {
      if (event.type === "rating-popover:rate") doc.rate(parseInt(event.detail.rating, 10))
      else doc.resetRating()
      query.touchModifiedAt()
    })
  }

  liveDocuments(query) {
    return [...(query.docs || []), ...(query.ratedDocs || [])].filter(
      (doc, index, docs) => docs.findIndex(candidate => String(candidate.id) === String(doc.id)) === index
    )
  }

  handleShowDocument(event) {
    event.preventDefault()
    event.stopPropagation()
    const query = this.angularScope?.query
    const docId = event.detail?.docId
    const doc = query && this.liveDocuments(query).find(candidate => String(candidate.id) === String(docId))
    if (!doc) return

    // Keep the existing detailed-document modal as a command adapter until
    // that modal is migrated. SearchResultCtrl owns no result rendering here.
    const injector = window.angular?.element(document.body).injector?.()
    const controller = injector?.get?.("$controller")
    if (!controller) return
    const scope = this.angularScope.$new()
    scope.doc = doc
    scope.query = query
    // Use a detached element: SearchResultCtrl registers legacy rating
    // listeners on its element and must not remove this controller's listeners
    // when the temporary command scope is destroyed.
    controller("SearchResultCtrl", { $scope: scope, $element: window.angular.element(document.createElement("div")) })
    scope.showDoc()
    scope.$destroy()
  }
}
