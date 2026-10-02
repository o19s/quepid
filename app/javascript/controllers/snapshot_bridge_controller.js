import { Controller } from "@hotwired/stimulus"
import { apiFetch } from "api/fetch"
import { deleteSnapshot, fetchSnapshot } from "utils/snapshot_api"
import { buildSnapshotPayload } from "utils/snapshot_payload"
import { createSnapshotModel } from "utils/snapshot_model"
import { registerAndHydrateSnapshots } from "utils/snapshot_hydration"
import { getSnapshotCapabilities } from "utils/core_capabilities_runtime"
import { getCoreStores } from "utils/core_store_access"
import { getCoreCapabilities } from "utils/core_capability_access"
import coreFlash from "utils/core_flash"

/*
 * Snapshot comparison bridge between the Stimulus read model and live queries.
 *
 * The comparison picker, snapshot registry/hydration, and renderer are
 * Stimulus-owned. The live Query model and snapshot scoring remain in the
 * live-query runtime, so this controller is the explicit boundary between
 * those two representations.
 */
export default class extends Controller {
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
    const caseNo = Number(this.element.dataset.coreBootstrapCaseNoValue)
    if (!caseNo) return

    try {
      const response = await apiFetch(`api/cases/${caseNo}/snapshots?shallow=true`)
      if (!response.ok) throw new Error(`Snapshot request failed (${response.status})`)
      const payload = await response.json()
      const registry = this.snapshotRegistry()
      Object.keys(registry).forEach((id) => delete registry[id])
      await this.registerSnapshots(payload.snapshots || [])
    } catch (error) {
      console.error("Could not bootstrap snapshots", error)
    }
  }

  async create(event) {
    const detail = event.detail || {}
    const services = await getSnapshotCapabilities()
    const caseNo = Number(detail.caseId)

    if (caseNo !== Number(services.capability.navigation.caseNo())) {
      detail.done?.("case mismatch")
      return
    }

    try {
      const payload = buildSnapshotPayload(
        detail.name,
        detail.recordDocumentFields,
        getCoreCapabilities().queryCapabilities.getQueryArray()
      )
      const response = await apiFetch(`api/cases/${caseNo}/snapshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      if (!response.ok) throw new Error(`Snapshot request failed (${response.status})`)
      const snapshot = await response.json()
      await this.registerSnapshots([snapshot])
      coreFlash.show("success", "Snapshot created successfully.")
      detail.done?.(null)
    } catch (error) {
      detail.done?.(error?.message || error)
    }
  }

  selectionRequest(event) {
    event.detail?.done?.(this.diffStore().selections())
  }

  async apply(event) {
    const detail = event.detail || {}
    const selections = detail.selections || []

    if (!detail.snapshotsUrl) {
      detail.done?.("Snapshot comparison services are not available")
      return
    }

    try {
      const [...payloads] = await Promise.all([
        ...selections.map((snapshotId) => fetchSnapshot(`${detail.snapshotsUrl}/${encodeURIComponent(snapshotId)}`))
      ])
      await this.registerSnapshots(payloads)
      this.diffStore().enable(selections)
      await this.refreshAllDiffs()
      detail.done?.(null)
    } catch (error) {
      detail.done?.(error)
    }
  }

  async clear(event) {
    const detail = event.detail || {}
    try {
      this.diffStore().disable()
      await this.refreshAllDiffs()
      detail.done?.(null)
    } catch (error) {
      detail.done?.(error)
    }
  }

  async delete(event) {
    const detail = event.detail || {}
    if (!detail.snapshotsUrl) {
      detail.done?.("Snapshot comparison services are not available")
      return
    }

    try {
      await deleteSnapshot(detail.snapshotsUrl, detail.snapshotId)
      const registry = this.snapshotRegistry()
      delete registry[String(detail.snapshotId)]
      this.diffStore().disable()
      await this.refreshAllDiffs()
      detail.done?.(null)
    } catch (error) {
      detail.done?.(error)
    }
  }
}
