import { Controller } from "@hotwired/stimulus"
import { apiFetch } from "api/fetch"
import { deleteSnapshot, fetchSnapshot } from "utils/snapshot_api"
import { buildSnapshotPayload } from "utils/snapshot_payload"
import { registerAndHydrateSnapshots } from "utils/snapshot_hydration"
import { getSnapshotCapabilities } from "utils/core_capabilities_runtime"
import { getCoreStores } from "utils/core_store_access"
import { getCoreCapabilities } from "utils/core_capability_access"
import coreFlash from "utils/core_flash"

/*
 * Temporary compatibility bridge for snapshot comparison.
 *
 * The comparison picker, snapshot registry/hydration, and renderer are
 * Stimulus/framework-free. The live Query model and snapshot scoring are
 * still owned by the live-query runtime, so this controller is the single,
 * explicit boundary between them while that larger migration is in progress.
 */
export default class extends Controller {
  connect() {
    this.onSelectionRequest = (event) => this.selectionRequest(event)
    this.onApply = (event) => this.apply(event)
    this.onClear = (event) => this.clear(event)
    this.onDelete = (event) => this.delete(event)
    this.onCreate = (event) => this.create(event)

    document.addEventListener("diff:selection-request", this.onSelectionRequest)
    document.addEventListener("diff:apply", this.onApply)
    document.addEventListener("diff:clear", this.onClear)
    document.addEventListener("diff:delete", this.onDelete)
    document.addEventListener("take-snapshot:create", this.onCreate)

    void this.bootstrapSnapshots()
  }

  disconnect() {
    document.removeEventListener("diff:selection-request", this.onSelectionRequest)
    document.removeEventListener("diff:apply", this.onApply)
    document.removeEventListener("diff:clear", this.onClear)
    document.removeEventListener("diff:delete", this.onDelete)
    document.removeEventListener("take-snapshot:create", this.onCreate)
  }

  diffStore() {
    return getCoreStores().diff
  }

  snapshotRegistry() {
    const snapshotSearch = getCoreCapabilities().snapshotSearch
    if (!snapshotSearch) return null
    snapshotSearch.snapshots ||= {}
    return snapshotSearch.snapshots
  }

  refreshAllDiffs() {
    return getCoreCapabilities().queryCapabilities?.refreshAllDiffs?.() || Promise.reject(new Error("Query diff services are not available"))
  }

  async registerSnapshots(payloads) {
    const { capability, docCache } = await getSnapshotCapabilities()
    const { settings, navigation, fieldSpec, documents } = capability
    const snapshotSearch = getCoreCapabilities().snapshotSearch
    const registry = this.snapshotRegistry()

    if (!settings || !navigation || !fieldSpec || !documents || !docCache || !snapshotSearch || !registry) {
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

        return snapshotSearch.createSnapshotModel({
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
      if (registry) Object.keys(registry).forEach((id) => delete registry[id])
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
      if (registry) delete registry[String(detail.snapshotId)]
      this.diffStore().disable()
      await this.refreshAllDiffs()
      detail.done?.(null)
    } catch (error) {
      detail.done?.(error)
    }
  }
}
