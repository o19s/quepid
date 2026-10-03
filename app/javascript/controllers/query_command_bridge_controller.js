import { Controller } from "@hotwired/stimulus"
import { getCoreStores } from "utils/core_store_access"
import { getCoreCapabilities } from "utils/core_capability_access"

/**
 * Routes query-workspace intents from the shared stores to the
 * explicit query-command runtime. The runtime still delegates to live-query-owned
 * Query objects today; keeping that compatibility boundary here means the
 * stores and Stimulus controllers do not need to know when the implementation
 * moves into the query runtime.
 */
export default class extends Controller {
  connect() {
    const stores = getCoreStores()
    this.collectionStore = stores.queries
    this.documentsStore = stores.documents
    this.handleDocumentCommand = event => this.routeDocumentCommand(event.detail || {})
    this.handleCollectionCommand = event => this.routeCollectionCommand(event.detail || {})

    this.documentsStore.addEventListener("command", this.handleDocumentCommand)
    this.collectionStore.addEventListener("command", this.handleCollectionCommand)
  }

  disconnect() {
    this.documentsStore?.removeEventListener("command", this.handleDocumentCommand)
    this.collectionStore?.removeEventListener("command", this.handleCollectionCommand)
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

  // Outlet API for `query-delete` and `move-query-core`: drops the removed live
  // Query object and rescores. A removal reported for another case is ignored.
  queryRemoved({ caseId, queryId }) {
    if (queryId == null) return

    const capabilities = getCoreCapabilities().queryCapabilities
    if (caseId != null && String(caseId) !== String(capabilities?.getCaseNo?.())) return
    capabilities?.reconcileQueryRemoval?.(queryId, true)
  }
}
