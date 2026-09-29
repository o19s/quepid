import { afterEach, describe, expect, it } from "vitest"
import { caseScoreStore } from "stores/case_score_store"
import { queryCollectionStore } from "stores/query_collection_store"
import { queryDocumentsStore } from "stores/query_documents_store"
import { diffStateStore } from "stores/diff_state_store"
import { getCoreStores } from "utils/core_store_access"

describe("getCoreStores", () => {
  afterEach(() => {
    delete window.quepidStore
  })

  it("preserves bridged stores and fills missing groups from framework-free stores", () => {
    const scoring = {}
    const stores = { scoring }
    window.quepidStore = stores

    expect(getCoreStores()).toEqual({
      scoring,
      queries: queryCollectionStore,
      documents: queryDocumentsStore,
      diff: diffStateStore
    })
  })

  it("provides the framework-free store singletons without the bridge", () => {
    expect(getCoreStores()).toEqual({
      scoring: caseScoreStore,
      queries: queryCollectionStore,
      documents: queryDocumentsStore,
      diff: diffStateStore
    })
  })
})
