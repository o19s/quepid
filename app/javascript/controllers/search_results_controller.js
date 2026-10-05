import { Controller } from "@hotwired/stimulus"
import { subscribeToStore } from "utils/store_subscription"
import { getCoreStores } from "utils/core_store_access"
import { openDetailedDocumentModal } from "utils/detailed_document_modal"
import { copyText } from "utils/clipboard"
import { createRatingControl } from "controllers/search_result_controller"
import { sanitizeSnippetHtml } from "utils/html"
import { engineDisplayName } from "utils/browse_query"
import { isSameId } from "utils/record_identity"

/**
 * Renders an expanded query from the plain document read model. The live-query runtime still
 * owns live search and mutations, but those are reached through explicit
 * command/state adapters rather than scope discovery.
 */
export default class extends Controller {
  static targets = [
    "content", "results", "diffResults", "notesBox", "scoreAll", "error", "footer", "nextPage",
    "browseTool", "depthNote", "depthValue", "ratedNote"
  ]

  connect() {
    this.store = getCoreStores().documents
    this.storeChange = event => this.renderFromStore(event.detail)
    this.unsubscribeStore = subscribeToStore(this.store, { change: this.storeChange, reset: this.storeChange })
    this.render()
  }

  disconnect() {
    this.unsubscribeStore?.()

  }

  closeNotes() {
    this.setNotesOpen(false)
  }

  renderFromStore(detail) {
    if (!detail || detail.queryId == null || isSameId(detail.queryId, this.queryId)) this.render()
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
    this.renderBrowseTool(snapshot)

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
    return this.element.closest("[data-query-id]")?.dataset.queryId
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
      this.errorTarget.innerHTML = sanitizeSnippetHtml(snapshot?.errorText)
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

  renderBrowseTool(snapshot) {
    if (!this.hasBrowseToolTarget) return
    this.browseToolTarget.replaceChildren()

    const supportsBrowse = snapshot?.queryState !== "error" && snapshot?.browseUrl && (
      snapshot.searchEngine === "solr" ||
      (snapshot.searchEngine === "searchapi" && snapshot.apiMethod === "GET")
    )
    if (!supportsBrowse) return

    const button = document.createElement("a")
    button.href = "#"
    button.className = "btn btn-primary"
    button.dataset.controller = "browse-query"
    button.dataset.action = "click->browse-query#open"
    button.dataset.browseQueryUrlValue = snapshot.browseUrl
    button.dataset.browseQueryEngineNameValue = engineDisplayName(snapshot)
    button.dataset.browseQueryHeadersValue = JSON.stringify(snapshot.browseHeaders || {})
    const count = Number(snapshot.numFound || 0)
    button.textContent = `Browse ${count} ${count === 1 ? "Result" : "Results"} on ${engineDisplayName(snapshot)}`
    this.browseToolTarget.appendChild(button)
  }

  canPaginate(snapshot) {
    const found = snapshot?.showOnlyRated ? snapshot.ratedDocsFound : snapshot?.numFound
    const loaded = this.visibleDocuments(snapshot).length
    return Number(found || 0) > loaded && snapshot?.paginationSupported !== false
  }

  paginate(event) {
    event.preventDefault()
    const ratedOnly = this.store.query(this.queryId)?.showOnlyRated === true
    this.store.requestPaginateQuery?.(this.queryId, ratedOnly)
  }

  collapse(event) {
    event.preventDefault()
    this.store.requestToggleQuery?.(this.queryId)
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
  }

  // Ask the notes panel to load its saved values the first time it renders open, once its
  // query-notes controller is connected. A panel that stays open keeps the user's edits.
  renderNotes(snapshot) {
    if (!this.hasNotesBoxTarget) return

    const box = this.notesBoxTarget
    const open = snapshot?.notes === true
    box.classList.toggle("d-none", !open)
    if (!open) {
      delete box.dataset.notesRequested
      return
    }
    if (box.dataset.notesRequested) return

    box.dataset.notesRequested = "true"
    requestAnimationFrame(() => {
      if (!box.isConnected) return
      box.querySelector('[data-controller~="query-notes"]')?.dispatchEvent(new CustomEvent("query-notes:open"))
    })
  }

  // Results are keyed by document id and reused, so a rating or other store change only
  // re-renders the documents that actually changed (keeping an open popover or explain elsewhere).
  renderDocuments(docs, snapshot) {
    const ids = docs.map(doc => String(doc.id))
    if (new Set(ids).size !== ids.length) {
      // Duplicate ids (documents that can't be uniquely identified) can't be keyed.
      this.resultsTarget.replaceChildren(...docs.map((doc, index) => this.buildSearchResult(doc, snapshot, index + 1)))
      return
    }

    const existing = new Map([...this.resultsTarget.children].map(result => [result.dataset.docId, result]))
    docs.forEach((doc, index) => {
      let result = existing.get(ids[index])
      if (result) {
        existing.delete(ids[index])
        this.assignSearchResult(result, doc, snapshot, index + 1)
      } else {
        result = this.buildSearchResult(doc, snapshot, index + 1)
      }
      const current = this.resultsTarget.children[index]
      if (current !== result) this.resultsTarget.insertBefore(result, current || null)
    })
    existing.forEach(result => result.remove())
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
          const difference = columnIndex > 0 ? this.resultDifferenceClass(currentDoc, doc) : ""
          if (difference) result.classList.add(difference)
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
    const content = document.createElement("div")
    content.dataset.searchResultTarget = "content"
    result.appendChild(content)
    this.assignSearchResult(result, doc, snapshot, rank, maxDocScore)
    return result
  }

  // Hands a result its document and query, and bumps its version value when anything its
  // rendering depends on changed; the search-result controller re-renders on a new version.
  // The fingerprint stays in a property: it holds the whole document, too big for an attribute.
  assignSearchResult(result, doc, snapshot, rank, maxDocScore) {
    const query = maxDocScore === undefined ? snapshot : { ...snapshot, maxDocScore }
    result.setAttribute("rank", String(rank))
    result.dataset.queryId = String(snapshot.queryId)
    result.dataset.docId = String(doc.id)
    result.dataset.rating = doc.rating == null ? "" : String(doc.rating)
    result.__searchResultDocument = doc
    result.__searchResultQuery = query
    const fingerprint = JSON.stringify([doc, rank, query.ratingScale, query.depthOfRating, query.maxDocScore])
    if (result.__searchResultFingerprint === fingerprint) return
    result.__searchResultFingerprint = fingerprint
    result.dataset.searchResultVersionValue = String(Number(result.dataset.searchResultVersionValue || 0) + 1)
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
      this.store.requestRateAll?.(this.queryId, rating)
      return
    }
    const docId = result?.__searchResultDocument?.id
    const rating = event.type === "rating-popover:rate" ? parseInt(event.detail.rating, 10) : null
    this.store.requestRateDocument?.(this.queryId, docId, rating)
  }

  renderScoreAll(snapshot) {
    if (!this.hasScoreAllTarget) return

    // The "Score All" shell is static ERB; only its rating control is rebuilt, and only on change.
    const slot = this.scoreAllTarget.querySelector('[data-slot="scoreAllRating"]')
    const rating = snapshot.queryRating ?? "--"
    const version = JSON.stringify([rating, snapshot.ratingScale || {}])
    if (slot.dataset.version === version) return
    slot.dataset.version = version
    slot.replaceChildren(createRatingControl(rating, snapshot.ratingScale || {}))
  }

  handleQueryToggle(event) {
    event.preventDefault()
    event.stopPropagation()
    this.store.requestToggleQuery?.(this.queryId)
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
    ].find(item => isSameId(item.id, docId))
    if (!snapshotDoc) return
    openDetailedDocumentModal({ doc: snapshotDoc, linkUrl: snapshotDoc.linkUrl })
  }
}
