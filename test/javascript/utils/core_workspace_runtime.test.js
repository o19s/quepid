import { describe, expect, it, vi } from "vitest"
import { createCoreWorkspaceRuntime } from "utils/core_workspace_runtime"
import { QueryCollectionStore } from "stores/query_collection_store"
import { CaseScoreStore } from "stores/case_score_store"

function buildWorkspace() {
  const store = { queries: new QueryCollectionStore(), scoring: new CaseScoreStore() }
  const splainerSearch = {
    fieldSpecSvc: { createFieldSpec: vi.fn((value) => ({ fields: value })) },
    docResolverSvc: { createResolver: vi.fn() },
    normalDocsSvc: { explainDoc: vi.fn() }
  }
  return {
    store,
    splainerSearch,
    workspace: createCoreWorkspaceRuntime({ splainerSearch, store, eventTarget: new EventTarget() })
  }
}

describe("core workspace construction", () => {
  it("returns usable query capabilities before bootstrap without fetching data", () => {
    const fetch = vi.spyOn(globalThis, "fetch")
    try {
      const { workspace } = buildWorkspace()
      expect(workspace.queryCapabilities.getCaseNo()).toBe(-1)
      expect(workspace.queryCapabilities.getQueries()).toEqual({})
      expect(workspace.queryCapabilities.getListState().searching).toBe(false)
      expect(workspace.queryCommands.toggleQuery(999)).toBe(false)
      expect(workspace.targetedSearch(999)).toBeNull()
      expect(workspace.queryLifecycle.refreshQueries).toBeTypeOf("function")
      expect(fetch).not.toHaveBeenCalled()
    } finally {
      fetch.mockRestore()
    }
  })

  it("shares settings, navigation and document dependencies across named groups", () => {
    const { workspace, splainerSearch } = buildWorkspace()
    const { bootstrap, snapshots, wizard, tuneRelevance } = workspace.caseRuntime
    bootstrap.core.navigation.complete({ caseNo: 7, tryNo: 1 })
    expect(wizard.capability.navigation.caseNo()).toBe(7)
    expect(snapshots.capability.navigation.caseNo()).toBe(7)
    expect(tuneRelevance.capability.navigation.currentCaseNo()).toBe(7)
    bootstrap.core.settings.setCaseTries([{ try_number: 1, search_engine: "solr", field_spec: "id,title" }])
    bootstrap.core.settings.setCurrentTry(1)
    expect(wizard.capability.settings.editable().selectedTry).toBe(bootstrap.core.settings.editable().selectedTry)
    expect(snapshots.capability.settings.editable().selectedTry).toBe(tuneRelevance.capability.settings.editable().selectedTry)
    expect(wizard.capability.documents.cache).toBe(workspace.docCache)
    expect(snapshots.docCache).toBe(bootstrap.docCache)
    expect(snapshots.capability.fieldSpec.create("id,title")).toEqual({ fields: "id,title" })
    expect(splainerSearch.fieldSpecSvc.createFieldSpec).toHaveBeenCalledWith("id,title")
  })

  it("keeps query ownership, snapshot registration and navigation local to each workspace", () => {
    const first = buildWorkspace()
    const second = buildWorkspace()
    first.store.queries.upsert({ queryId: 3, queryText: "first" })
    first.workspace.snapshotRegistry[5] = { id: 5 }
    first.workspace.caseRuntime.bootstrap.core.navigation.complete({ caseNo: 7, tryNo: 1 })
    expect(first.workspace.queryCapabilities.getQuery(3).queryText).toBe("first")
    expect(second.workspace.queryCapabilities.getQuery(3)).toBeNull()
    expect(second.workspace.snapshotRegistry).toEqual({})
    expect(second.workspace.caseRuntime.wizard.capability.navigation.caseNo()).not.toBe(7)
    first.workspace.queryCapabilities.resetQueryState()
    expect(second.workspace.queryCapabilities.getQueries()).toEqual({})
  })
})
