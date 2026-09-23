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
    "content", "results", "diffResults", "notesBox", "scoreAll", "error", "footer", "nextPage",
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
      if (expanded && this.hasDiffResultsTarget) this.renderDiffResults(snapshot)
      else if (this.hasDiffResultsTarget) this.diffResultsTarget.replaceChildren()
      return
    }

    if (this.hasDiffResultsTarget) this.diffResultsTarget.replaceChildren()
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
    const ratedOnly = this.store.query(this.queryId)?.showOnlyRated === true
    if (this.store.requestPaginateQuery) {
      this.store.requestPaginateQuery(this.queryId, ratedOnly)
    } else {
      window.quepidSearch?.queryState?.paginateQuery?.(this.queryId, ratedOnly)
    }
  }

  collapse(event) {
    event.preventDefault()
    if (this.store.requestToggleQuery) {
      this.store.requestToggleQuery(this.queryId)
    } else {
      window.quepidSearch?.queryState?.toggleQuery?.(this.queryId)
    }
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

  renderDiffResults(snapshot) {
    const diffs = snapshot.diffs
    if (!diffs || !diffs.searchers?.length) {
      this.diffResultsTarget.replaceChildren()
      return
    }

    const columns = [
      { name: "Current Results", docs: this.visibleDocuments(snapshot), maxDocScore: snapshot.maxDocScore }
    ].concat(diffs.searchers.map(searcher => ({
      ...searcher,
      docs: snapshot.showOnlyRated ? searcher.ratedDocs : searcher.docs
    })))

    const container = document.createElement("div")
    container.className = "diff-container"
    const header = document.createElement("div")
    header.className = "diff-header"
    columns.forEach(column => {
      const cell = document.createElement("div")
      cell.className = "diff-column"
      const title = document.createElement("h2")
      title.textContent = column.name
      cell.appendChild(title)
      header.appendChild(cell)
    })
    container.appendChild(header)

    const rowCount = Math.max(10, ...columns.map(column => column.docs.length))
    for (let index = 0; index < rowCount; index += 1) {
      const row = document.createElement("div")
      row.className = "diff-row"
      const currentDoc = columns[0].docs[index]
      columns.forEach((column, columnIndex) => {
        const cell = document.createElement("div")
        cell.className = "diff-column"
        const doc = column.docs[index]
        if (columnIndex > 0 && index === 0 && column.inError) {
          const error = document.createElement("div")
          error.className = "alert alert-danger"
          error.setAttribute("role", "alert")
          error.textContent = column.searchError
          cell.appendChild(error)
        } else if (columnIndex > 0 && index === 0 && !doc) {
          const warning = document.createElement("div")
          warning.className = "alert alert-warning"
          warning.setAttribute("role", "alert")
          warning.textContent = "This query is not present in the snapshot so it is treated as ZSR."
          cell.appendChild(warning)
        }

        if (doc) {
          const result = this.buildSearchResult(doc, snapshot, index + 1, column.maxDocScore)
          if (columnIndex > 0) result.classList.add(this.resultDifferenceClass(currentDoc, doc))
          cell.appendChild(result)
        } else if (!(columnIndex > 0 && index === 0 && column.inError)) {
          const empty = document.createElement("div")
          empty.className = "alert alert-info"
          empty.innerHTML = `<small>No result at position ${index + 1}</small>`
          cell.appendChild(empty)
        }
        row.appendChild(cell)
      })
      container.appendChild(row)
    }

    if (snapshot.queryState !== "error" && snapshot.searchEngine === "solr" && snapshot.browseUrl) {
      const actions = document.createElement("div")
      actions.className = "diff-actions"
      const link = document.createElement("a")
      link.className = "btn btn-primary"
      link.href = snapshot.browseUrl
      link.target = "_blank"
      link.rel = "noopener noreferrer"
      link.textContent = `Browse ${snapshot.numFound || 0} Current Results on Solr`
      actions.appendChild(link)
      container.appendChild(actions)
    }

    this.diffResultsTarget.replaceChildren(container)
  }

  buildSearchResult(doc, snapshot, rank, maxDocScore) {
    const result = document.createElement("search-result")
    result.className = "search-result"
    result.setAttribute("data-controller", "search-result")
    result.setAttribute("data-search-result-explain-view-value", "full")
    result.setAttribute("rank", String(rank))
    result.dataset.queryId = String(snapshot.queryId)
    result.dataset.docId = String(doc.id)
    result.__searchResultDocument = doc
    result.__searchResultQuery = { ...snapshot, maxDocScore }
    result.innerHTML = '<div data-search-result-target="content"></div>'
    return result
  }

  resultDifferenceClass(currentDoc, diffDoc) {
    if (!currentDoc && !diffDoc) return ""
    if (!currentDoc) return "missing"
    if (!diffDoc) return "new"
    return currentDoc.id === diffDoc.id ? "" : "different"
  }

  handleRating(event) {
    event.stopPropagation()
    const snapshot = this.store.query(this.queryId)
    if (!snapshot) return

    const result = event.target.closest("search-result")
    if (!result) {
      const rating = event.type === "rating-popover:rate" ? parseInt(event.detail.rating, 10) : null
      if (this.store.requestRateAll) {
        this.store.requestRateAll(this.queryId, rating)
      } else {
        window.quepidSearch?.queryState?.rateAll?.(this.queryId, rating)
      }
      return
    }
    const docId = result?.__searchResultDocument?.id
    const rating = event.type === "rating-popover:rate" ? parseInt(event.detail.rating, 10) : null
    if (this.store.requestRateDocument) {
      this.store.requestRateDocument(this.queryId, docId, rating)
    } else {
      window.quepidSearch?.queryState?.rateDocument?.(this.queryId, docId, rating)
    }
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
    if (this.store.requestToggleQuery) {
      this.store.requestToggleQuery(this.queryId)
    } else {
      window.quepidSearch?.queryState?.toggleQuery?.(this.queryId)
    }
  }

  handleShowDocument(event) {
    event.preventDefault()
    event.stopPropagation()
    const docId = event.detail?.docId
    const snapshot = this.store.query(this.queryId)
    const diffDocuments = (snapshot?.diffs?.searchers || []).flatMap(searcher => [
      ...(searcher.docs || []),
      ...(searcher.ratedDocs || [])
    ])
    const snapshotDoc = [
      ...(snapshot?.docs || []),
      ...(snapshot?.ratedDocs || []),
      ...diffDocuments
    ].find(item => String(item.id) === String(docId))
    if (!snapshotDoc) return
    openDetailedDocumentModal({ doc: snapshotDoc, linkUrl: snapshotDoc.linkUrl })
  }
}
