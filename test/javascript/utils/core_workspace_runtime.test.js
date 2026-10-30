import { afterEach, describe, expect, it, vi } from "vitest"
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
    bootstrap.core.settings.setCaseTries([
      { try_number: 1, search_engine: "solr", field_spec: "id,title" }
    ])
    bootstrap.core.settings.setCurrentTry(1)
    expect(wizard.capability.settings.editable().selectedTry).toBe(
      bootstrap.core.settings.editable().selectedTry
    )
    const draft = tuneRelevance.capability.settings.editable()
    draft.queryParams = "q=shared"
    expect(snapshots.capability.settings.editable().selectedTry.queryParams).toBe("q=shared")
    expect(tuneRelevance.capability.settings.tries()).toBe(bootstrap.core.settings.editable().tries)
    expect(draft.curatorVars).toBe(wizard.capability.settings.editable().selectedTry.curatorVars)
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

  it("preserves receivers, return identity and synchronous errors for detached callbacks", () => {
    const { workspace, splainerSearch } = buildWorkspace()
    const initialize = workspace.caseRuntime.bootstrap.core.case.initialize
    expect(initialize({ case_id: 7, case_name: "Receiver contract" }).caseNo).toBe(7)
    const result = Promise.resolve({ explained: true })
    splainerSearch.normalDocsSvc.explainDoc = function (...args) {
      expect(this).toBe(splainerSearch.normalDocsSvc)
      expect(args).toEqual(["doc", "explain"])
      return result
    }
    const explain = workspace.caseRuntime.snapshots.capability.documents.explain
    expect(explain("doc", "explain")).toBe(result)
    const failure = new Error("invalid document")
    splainerSearch.normalDocsSvc.explainDoc = function () {
      expect(this).toBe(splainerSearch.normalDocsSvc)
      throw failure
    }
    expect(() => explain()).toThrow(failure)
  })

  it("keeps tuning's null/draft contract distinct from wizard's editable projection", () => {
    const { workspace } = buildWorkspace()
    const { bootstrap, wizard, tuneRelevance } = workspace.caseRuntime
    expect(tuneRelevance.capability.settings.editable()).toBeNull()
    expect(wizard.capability.settings.editable()).toEqual({})
    bootstrap.core.settings.setCaseTries([
      { try_number: 1, search_engine: "solr", query_params: "q=original" }
    ])
    bootstrap.core.settings.setCurrentTry(1)
    const wizardSettings = { ...wizard.capability.settings.editable() }
    const draft = tuneRelevance.capability.settings.editable()
    wizardSettings.queryParams = "q=wizard"
    expect(draft.queryParams).toBe("q=original")
    draft.queryParams = "q=tuning"
    expect(wizardSettings.selectedTry.queryParams).toBe("q=tuning")
    expect(wizardSettings.queryParams).toBe("q=wizard")
    bootstrap.core.settings.setCurrentTry(999)
    expect(tuneRelevance.capability.settings.editable()).toBeNull()
    expect(wizard.capability.settings.editable().selectedTry).toBeNull()
  })

  describe("delegation to the runtimes it wires together", () => {
    const jsonResponse = (data = {}) => ({
      ok: true,
      status: 200,
      json: async () => data,
      text: async () => JSON.stringify(data)
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    function stubBrowser() {
      const assign = vi.fn()
      vi.stubGlobal("window", { location: { assign } })
      vi.stubGlobal("location", {
        href: "http://quepid.test/case/7/try/2",
        search: "",
        protocol: "http:"
      })
      const request = vi.fn(() => Promise.resolve(jsonResponse()))
      vi.stubGlobal("fetch", request)
      return { assign, request }
    }

    function openCase(workspace) {
      const { bootstrap } = workspace.caseRuntime
      bootstrap.core.navigation.complete({ caseNo: 7, tryNo: 2 })
      bootstrap.core.settings.setCaseTries([
        { try_number: 1, search_engine: "solr", field_spec: "id,title" },
        { try_number: 2, search_engine: "solr", field_spec: "id,body" }
      ])
      bootstrap.core.settings.setCurrentTry(2)
      return bootstrap
    }

    it("sends tuning's try changes to the open case and navigates through the navigation runtime", async () => {
      const { assign, request } = stubBrowser()
      const { workspace } = buildWorkspace()
      const { tuneRelevance } = workspace.caseRuntime
      openCase(workspace)

      tuneRelevance.capability.navigation.goToTry(5)
      expect(assign).toHaveBeenLastCalledWith("http://quepid.test/case/7/try/5")

      await tuneRelevance.capability.settings.deleteTry(2)
      expect(request).toHaveBeenCalledWith(
        "api/cases/7/tries/2",
        expect.objectContaining({ method: "DELETE" })
      )
      expect(assign).toHaveBeenLastCalledWith("http://quepid.test/case/7/try/1")
    })

    it("saves wizard settings against the current case and try, then navigates to that try", async () => {
      const { assign, request } = stubBrowser()
      const { workspace } = buildWorkspace()
      openCase(workspace)
      const { settings } = workspace.caseRuntime.wizard.capability

      await settings.update(settings.editable())

      expect(request).toHaveBeenCalledWith(
        "api/cases/7/tries/2",
        expect.objectContaining({ method: "PUT" })
      )
      expect(assign).toHaveBeenLastCalledWith("http://quepid.test/case/7/try/2")
    })

    it("builds each try's field spec through the search library", () => {
      stubBrowser()
      const { workspace, splainerSearch } = buildWorkspace()
      const bootstrap = openCase(workspace)

      expect(bootstrap.core.settings.editable().selectedTry.createFieldSpec()).toEqual({
        fields: "id,body"
      })
      expect(splainerSearch.fieldSpecSvc.createFieldSpec).toHaveBeenLastCalledWith("id,body")
    })

    it("resolves cached documents through the search library, proxied through the endpoint when asked", async () => {
      stubBrowser()
      const { workspace, splainerSearch } = buildWorkspace()
      const fetchDocs = vi.fn(() => Promise.resolve())
      splainerSearch.docResolverSvc.createResolver.mockReturnValue({ fetchDocs, docs: {} })
      const { docCache } = workspace

      docCache.addIds(["a", "b"])
      await docCache.update({ proxyRequests: true, searchEndpointId: 3 })

      expect(splainerSearch.docResolverSvc.createResolver).toHaveBeenCalledWith(
        ["a", "b"],
        expect.objectContaining({
          proxyUrl: expect.stringMatching(/\/proxy\/fetch\?search_endpoint_id=3&url=$/)
        }),
        15
      )
      expect(fetchDocs).toHaveBeenCalledOnce()
    })
  })
})
