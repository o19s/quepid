import { caseScoreStore } from "stores/case_score_store"
import { queryCollectionStore } from "stores/query_collection_store"
import { queryDocumentsStore } from "stores/query_documents_store"
import { diffStateStore } from "stores/diff_state_store"

// The compiled case runtime and importmap controllers do not share module
// singletons yet. Keep that compatibility detail in one place while exposing
// a stable store dependency to modern controllers.
export function getCoreStores() {
  const bridgedStores = typeof window !== "undefined" ? window.quepidStore : null

  return {
    scoring: bridgedStores?.scoring || caseScoreStore,
    queries: bridgedStores?.queries || queryCollectionStore,
    documents: bridgedStores?.documents || queryDocumentsStore,
    diff: bridgedStores?.diff || diffStateStore
  }
}
