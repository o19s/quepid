import { caseScoreStore } from "stores/case_score_store"
import { queryCollectionStore } from "stores/query_collection_store"
import { queryDocumentsStore } from "stores/query_documents_store"
import { diffStateStore } from "stores/diff_state_store"
import { getCoreStoresOverride } from "utils/core_test_overrides"

// The core entry imports these stores once. Keep this accessor as the stable
// store boundary while controllers are migrated independently.
export function getCoreStores() {
  return {
    scoring: getCoreStoresOverride()?.scoring || caseScoreStore,
    queries: getCoreStoresOverride()?.queries || queryCollectionStore,
    documents: getCoreStoresOverride()?.documents || queryDocumentsStore,
    diff: getCoreStoresOverride()?.diff || diffStateStore
  }
}
