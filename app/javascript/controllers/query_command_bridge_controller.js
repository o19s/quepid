import { Controller } from "@hotwired/stimulus"
import { getCoreStores } from "utils/core_store_access"
import { getCoreCapabilities } from "utils/core_capability_access"

/**
 * Routes query-workspace intents from the framework-free stores to the
 * explicit query-command runtime. The runtime still delegates to Angular-owned
 * Query objects today; keeping that compatibility boundary here means the
 * stores and Stimulus controllers do not need to know when the implementation
 * moves out of Angular.
 */
export default class extends Controller {
  connect() {
    const stores = getCoreStores()
    this.collectionStore = stores.queries
    this.documentsStore = stores.documents
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
    const queryCommands = getCoreCapabilities().queryCommands
    const handlers = {
      "rate-document": () => queryCommands?.rateDocument?.(queryId, docId, rating),
      "rate-all": () => queryCommands?.rateAll?.(queryId, rating),
      "toggle-query": () => queryCommands?.toggleQuery?.(queryId),
      "paginate-query": () => queryCommands?.paginateQuery?.(queryId, ratedOnly)
    }

    handlers[command]?.()
  }

  routeCollectionCommand({ command }) {
    const queryCommands = getCoreCapabilities().queryCommands
    if (command === "toggle-show-only-rated") queryCommands?.toggleShowOnlyRated?.()
    if (command === "collapse-all") {
      queryCommands?.collapseAll?.()
      this.collectionStore.collapseAll()
      this.documentsStore.collapseAll()
    }
  }

  reconcileQueryRemoval({ caseId, queryId }, rescore) {
    if (queryId == null) return

    const capabilities = getCoreCapabilities().queryCapabilities
    if (rescore && caseId != null && String(caseId) !== String(capabilities?.getCaseNo?.())) return
    capabilities?.reconcileQueryRemoval?.(queryId, rescore)
  }
}
