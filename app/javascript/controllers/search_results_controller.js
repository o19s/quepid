import { Controller } from "@hotwired/stimulus"

/**
 * Owns the read-only portion of an expanded query row. Angular continues to
 * own the query service and the toolbar mutations until the query-state seam
 * is migrated, but it no longer repeats the document result DOM.
 */
export default class extends Controller {
  static targets = ["content", "results"]

  connect() {
    this.childScopes = []
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
      () => this.renderVersion(),
      () => this.render()
    )
    this.render()
  }

  disconnect() {
    if (this.retryHandle) cancelAnimationFrame(this.retryHandle)
    if (this.watchHandle) this.watchHandle()
    this.destroyChildScopes()
    this.angularScope = null
  }

  renderVersion() {
    const query = this.angularScope?.query
    if (!query) return ""

    return [
      query.isToggled?.(),
      query.state?.(),
      query.version?.(),
      (query.docs || []).map(doc => doc.id).join(","),
      (query.ratedDocs || []).map(doc => doc.id).join(","),
      query.numFound,
      this.angularScope.queriesSvc?.showOnlyRated,
      this.angularScope.displayed?.results
    ].join(":")
  }

  render() {
    if (!this.angularScope || !this.hasContentTarget || !this.hasResultsTarget) return

    const query = this.angularScope.query
    if (!query) return

    const expanded = query.isToggled?.() === true
    this.contentTarget.classList.toggle("d-none", !expanded)

    if (!expanded || !this.isResultsView()) {
      this.destroyChildScopes()
      this.resultsTarget.replaceChildren()
      return
    }

    const docs = this.visibleDocuments(query)
    this.renderDocuments(docs, query)
  }

  visibleDocuments(query) {
    return this.angularScope.queriesSvc?.showOnlyRated ? query.ratedDocs || [] : query.docs || []
  }

  isResultsView() {
    const displayed = this.angularScope.displayed
    return !displayed || displayed.results === displayed.resultsView?.results
  }

  renderDocuments(docs, query) {
    this.destroyChildScopes()
    const fragment = document.createDocumentFragment()

    docs.forEach((doc, index) => {
      const element = document.createElement("search-result")
      element.className = "search-result"
      element.setAttribute("data-controller", "search-result")
      element.setAttribute("data-search-result-explain-view-value", "full")
      element.setAttribute("rank", String(index + 1))
      element.innerHTML = '<div data-search-result-target="content"></div>'

      const childScope = this.createDocumentScope(doc, query, element)
      element.__angularScope = childScope
      window.angular?.element(element).data("$scope", childScope)
      this.childScopes.push(childScope)
      fragment.appendChild(element)
    })

    this.resultsTarget.replaceChildren(fragment)
  }

  createDocumentScope(doc, query, element) {
    const childScope = this.angularScope.$new()
    childScope.doc = doc
    childScope.query = query
    childScope.fieldSpec = query.fieldSpec
    childScope.maxDocScore = query.maxDocScore?.()

    const injector = window.angular?.element(document.body).injector?.()
    const controller = injector?.get?.("$controller")
    if (controller) {
      controller("SearchResultCtrl", {
        $scope: childScope,
        $element: window.angular.element(element)
      })
    }

    return childScope
  }

  destroyChildScopes() {
    this.childScopes?.forEach(scope => scope.$destroy())
    this.childScopes = []
  }
}
