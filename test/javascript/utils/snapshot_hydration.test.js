import { describe, expect, it } from "vitest"
import {
  buildSnapshotLookupSettings,
  mapFieldSpecToSolrFormat,
  registerAndHydrateSnapshots,
  registerSnapshotModels
} from "utils/snapshot_hydration"

describe("snapshot hydration", () => {
  it("maps the reserved snapshot id field", () => {
    expect(mapFieldSpecToSolrFormat("title:title id:_id body:body")).toBe("title:title id:id body:body")
  })

  it("builds Solr lookup settings for static and unsupported engines", () => {
    const settings = {
      searchEngine: "searchapi",
      fieldSpec: "id:_id title:title",
      apiMethod: "POST",
      searchEndpointId: 9,
      customHeaders: { Authorization: "secret" },
      searchUrl: "https://engine.example/search"
    }

    const result = buildSnapshotLookupSettings({
      settings,
      supportsLookupById: () => false,
      createFieldSpec: (value) => ({ raw: value }),
      rootUrl: "",
      caseNo: 12,
      snapshotId: 44
    })

    expect(result).toEqual({
      ...settings,
      apiMethod: "GET",
      searchEngine: "solr",
      fieldSpec: { raw: "id:id title:title" },
      searchEndpointId: null,
      customHeaders: null,
      searchUrl: "/api/cases/12/snapshots/44/search"
    })
    expect(settings.searchEngine).toBe("searchapi")
  })

  it("keeps normal lookup settings unchanged", () => {
    const settings = { searchEngine: "solr", fieldSpec: "id:id" }
    expect(buildSnapshotLookupSettings({
      settings,
      supportsLookupById: () => true,
      createFieldSpec: () => {
        throw new Error("should not create a replacement field spec")
      },
      rootUrl: "",
      caseNo: 1,
      snapshotId: 2
    })).toBe(settings)
  })

  it("registers models and adds their document ids to the cache", () => {
    const registry = {}
    const addedIds = []
    const models = registerSnapshotModels({
      snapshots: [{ id: 7 }, { id: 8 }],
      registry,
      addDocIds: (ids) => addedIds.push(...ids),
      createModel: ({ params }) => ({ id: params.id, allDocIds: () => [String(params.id)] }),
      getDoc: () => null,
      explainDoc: (doc) => doc
    })

    expect(models.map((model) => model.id)).toEqual([7, 8])
    expect(registry[7]).toBe(models[0])
    expect(registry[8]).toBe(models[1])
    expect(addedIds).toEqual(["7", "8"])
  })

  it("hydrates each scoped snapshot independently", async () => {
    const updates = []
    const scopedIds = []
    const clearedScopes = []

    const result = registerAndHydrateSnapshots({
      snapshots: [{ id: 7 }, { id: 8 }],
      registry: {},
      settings: { searchEngine: "static", fieldSpec: "id:id" },
      supportsLookupById: () => true,
      createFieldSpec: (value) => value,
      rootUrl: "",
      caseNo: 12,
      addDocIds: () => {},
      addScopedDocIds: (ids, scope) => scopedIds.push({ ids, scope }),
      clearScopedDocs: (scope) => clearedScopes.push(scope),
      updateDocs: (snapshotSettings, scope) => {
        updates.push({ snapshotSettings, scope })
        return Promise.resolve()
      },
      createModel: ({ params }) => ({ allDocIds: () => [`doc-${params.id}`] }),
      getDoc: () => null,
      explainDoc: (doc) => doc
    })

    await result.promise

    expect(clearedScopes).toEqual([7, 8])
    expect(scopedIds).toEqual([
      { ids: ["doc-7"], scope: 7 },
      { ids: ["doc-8"], scope: 8 }
    ])
    expect(updates.map(({ scope }) => scope)).toEqual([7, 8])
    expect(updates[0].snapshotSettings.searchUrl).toBe("/api/cases/12/snapshots/7/search")
    expect(updates[1].snapshotSettings.searchUrl).toBe("/api/cases/12/snapshots/8/search")
  })
})
