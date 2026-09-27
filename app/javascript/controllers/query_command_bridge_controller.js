import { Controller } from "@hotwired/stimulus"
import { queryCollectionStore } from "stores/query_collection_store"
import { queryDocumentsStore } from "stores/query_documents_store"

/**
 * Routes query-workspace intents from the framework-free stores to the
 * temporary live-query adapter. The adapter still delegates to Angular-owned
 * Query objects today; keeping that compatibility boundary here means the
 * stores and Stimulus controllers do not need to know when the implementation
 * moves out of Angular.
 */
export default class extends Controller {
  connect() {
    this.collectionStore = window.quepidStore?.queries || queryCollectionStore
    this.documentsStore = window.quepidStore?.documents || queryDocumentsStore
    this.handleDocumentCommand = event => this.routeDocumentCommand(event.detail || {})
    this.handleCollectionCommand = event => this.routeCollectionCommand(event.detail || {})
    this.handleQueryDeleteCompleted = event => this.reconcileQueryRemoval(event.detail || {}, false)
    this.handleQueryMoveCompleted = event => this.reconcileQueryRemoval(event.detail || {}, true)

    this.documentsStore.addEventListener("command", this.handleDocumentCommand)
    this.collectionStore.addEventListener("command", this.handleCollectionCommand)
    document.addEventListener("query-command:delete-completed", this.handleQueryDeleteCompleted)
    document.addEventListener("query-command:move-completed", this.handleQueryMoveCompleted)
  }

  disconnect() {
    this.documentsStore?.removeEventListener("command", this.handleDocumentCommand)
    this.collectionStore?.removeEventListener("command", this.handleCollectionCommand)
    document.removeEventListener("query-command:delete-completed", this.handleQueryDeleteCompleted)
    document.removeEventListener("query-command:move-completed", this.handleQueryMoveCompleted)
  }

  routeDocumentCommand({ command, queryId, docId, rating, ratedOnly }) {
    const queryState = window.quepidSearch?.queryState
    const handlers = {
      "rate-document": () => queryState?.rateDocument?.(queryId, docId, rating),
      "rate-all": () => queryState?.rateAll?.(queryId, rating),
      "toggle-query": () => queryState?.toggleQuery?.(queryId),
      "paginate-query": () => queryState?.paginateQuery?.(queryId, ratedOnly)
    }

    handlers[command]?.()
  }

  routeCollectionCommand({ command }) {
    const queryState = window.quepidSearch?.queryState
    if (command === "toggle-show-only-rated") queryState?.toggleShowOnlyRated?.()
    if (command === "collapse-all") {
      queryState?.collapseAll?.()
      this.collectionStore.collapseAll()
      this.documentsStore.collapseAll()
    }
  }

  reconcileQueryRemoval({ caseId, queryId }, rescore) {
    if (queryId == null) return

    const queryState = window.quepidSearch?.queryState
    if (rescore && caseId != null && String(caseId) !== String(queryState?.getCaseNo?.())) return
    queryState?.reconcileQueryRemoval?.(queryId, rescore)
  }
}
