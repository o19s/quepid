import { caseScoreStore } from "stores/case_score_store"
import { queryCollectionStore } from "stores/query_collection_store"
import { queryDocumentsStore } from "stores/query_documents_store"
import { diffStateStore } from "stores/diff_state_store"

/**
 * Module-owned stores for the case workspace's live state. The core entry and
 * its controllers import these singleton modules directly.
 */
const quepidStore = {
  scoring: caseScoreStore,
  queries: queryCollectionStore,
  documents: queryDocumentsStore,
  diff: diffStateStore
}

export default quepidStore
