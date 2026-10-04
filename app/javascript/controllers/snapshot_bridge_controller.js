import { Controller } from "@hotwired/stimulus"
import { getJson, postJson } from "api/json"
import { deleteSnapshot, fetchSnapshot } from "utils/snapshot_api"
import { buildSnapshotPayload } from "utils/snapshot_payload"
import { createSnapshotModel } from "utils/snapshot_model"
import { registerAndHydrateSnapshots } from "utils/snapshot_hydration"
import { getSnapshotCapabilities } from "utils/core_capabilities_runtime"
import { getCoreStores } from "utils/core_store_access"
import { getCoreCapabilities } from "utils/core_capability_access"
import coreFlash from "utils/core_flash"
import { isSameId } from "utils/record_identity"

/*
 * Snapshot comparison bridge between the Stimulus read model and live queries.
 *
 * The comparison picker, snapshot registry/hydration, and renderer are
 * Stimulus-owned. The live Query model and snapshot scoring remain in the
 * live-query runtime, so this controller is the explicit boundary between
 * those two representations.
 *
 * `diff-core` and `take-snapshot-core` reach it as the `snapshot-bridge`
 * outlet (it sits on <body>). Its commands return promises that reject on
 * failure.
 */
export default class extends Controller {
  static values = { snapshotsUrl: String }

  connect() {
    void this.bootstrapSnapshots()
  }

  diffStore() {
    return getCoreStores().diff
  }

  snapshotRegistry() {
    const capabilities = getCoreCapabilities()
    capabilities.snapshotRegistry ||= {}
    return capabilities.snapshotRegistry
  }

  refreshAllDiffs() {
    return getCoreCapabilities().queryCapabilities?.refreshAllDiffs?.() || Promise.reject(new Error("Query diff services are not available"))
  }

  async registerSnapshots(payloads) {
    const { capability, docCache } = await getSnapshotCapabilities()
    const { settings, navigation, fieldSpec, documents } = capability
    const registry = this.snapshotRegistry()

    if (!settings || !navigation || !fieldSpec || !documents || !docCache) {
      throw new Error("Snapshot runtime is not available")
    }

    const currentSettings = settings.editable()
    const useSnapshotScopedCache = currentSettings && Object.keys(currentSettings).length > 0 && (
      currentSettings.searchEngine === "static" || settings.supportsLookupById(currentSettings.searchEngine) === false
    )
    const hydration = registerAndHydrateSnapshots({
      snapshots: payloads,
      registry,
      settings: currentSettings,
      supportsLookupById: settings.supportsLookupById,
      createFieldSpec: fieldSpec.create,
      rootUrl: navigation.rootUrl(),
      caseNo: navigation.caseNo(),
      addDocIds: ids => docCache.addIds(ids),
      addScopedDocIds: (ids, scope) => docCache.addIds(ids, scope),
      clearScopedDocs: scope => docCache.empty(scope),
      updateDocs: (hydrationSettings, scope) => docCache.update(hydrationSettings, scope),
      createModel: options => {
        const getDoc = useSnapshotScopedCache
          ? id => docCache.getDoc(id, options.params.id)
          : options.getDoc

        return createSnapshotModel({
          params: options.params,
          getDoc,
          explainDoc: options.explainDoc,
          formatDate: time => new Date(time).toLocaleDateString("en-US"),
          log: options.log
        })
      },
      getDoc: docCache.getDoc,
      explainDoc: documents.explain,
      formatDate: time => new Date(time).toLocaleDateString("en-US"),
      log: message => console.debug(message)
    })

    await hydration.promise
  }

  async bootstrapSnapshots() {
    if (!this.snapshotsUrlValue) return

    try {
      const payload = await getJson(`${this.snapshotsUrlValue}?shallow=true`)
      const registry = this.snapshotRegistry()
      Object.keys(registry).forEach((id) => delete registry[id])
      await this.registerSnapshots(payload.snapshots || [])
    } catch (error) {
      console.error("Could not bootstrap snapshots", error)
    }
  }

  async create({ caseId, name, recordDocumentFields }) {
    const services = await getSnapshotCapabilities()
    if (!isSameId(caseId, services.capability.navigation.caseNo())) throw new Error("case mismatch")

    const payload = buildSnapshotPayload(
      name,
      recordDocumentFields,
      getCoreCapabilities().queryCapabilities.getQueryArray()
    )
    const snapshot = await postJson(this.snapshotsUrlValue, payload)
    await this.registerSnapshots([snapshot])
    coreFlash.show("success", "Snapshot created successfully.")
  }

  currentSelections() {
    return this.diffStore().selections()
  }

  async apply({ selections = [], snapshotsUrl }) {
    if (!snapshotsUrl) throw new Error("Snapshot comparison services are not available")

    const payloads = await Promise.all(
      selections.map((snapshotId) => fetchSnapshot(`${snapshotsUrl}/${encodeURIComponent(snapshotId)}`))
    )
    await this.registerSnapshots(payloads)
    this.diffStore().enable(selections)
    await this.refreshAllDiffs()
  }

  async clear() {
    this.diffStore().disable()
    await this.refreshAllDiffs()
  }

  async delete({ snapshotId, snapshotsUrl }) {
    if (!snapshotsUrl) throw new Error("Snapshot comparison services are not available")

    await deleteSnapshot(snapshotsUrl, snapshotId)
    delete this.snapshotRegistry()[String(snapshotId)]
    this.diffStore().disable()
    await this.refreshAllDiffs()
  }
}
