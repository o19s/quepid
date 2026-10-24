import { describe, expect, it } from "vitest"
import { caseScoreStore } from "stores/case_score_store"
import { queryCollectionStore } from "stores/query_collection_store"
import { queryDocumentsStore } from "stores/query_documents_store"
import { diffStateStore } from "stores/diff_state_store"
import { getCoreStores } from "utils/core_store_access"

describe("getCoreStores", () => {
  it("provides the module-owned store singletons", () => {
    expect(getCoreStores()).toEqual({
      scoring: caseScoreStore,
      queries: queryCollectionStore,
      documents: queryDocumentsStore,
      diff: diffStateStore
    })
  })
})
