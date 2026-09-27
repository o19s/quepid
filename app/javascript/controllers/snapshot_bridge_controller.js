import { Controller } from "@hotwired/stimulus"
import { deleteSnapshot, fetchSnapshot } from "utils/snapshot_api"
import { diffStateStore } from "stores/diff_state_store"
import { registerAndHydrateSnapshots } from "utils/snapshot_hydration"
import { getSnapshotCapabilities } from "utils/core_angular_adapter"

/*
 * Temporary compatibility bridge for snapshot comparison.
 *
 * The comparison picker, snapshot registry/hydration, and renderer are
 * Stimulus/framework-free. The live Query model and snapshot scoring are
 * still Angular-owned, so this controller is the single, explicit boundary
 * between them while that larger migration is in progress.
 */
export default class extends Controller {
  connect() {
    this.onSelectionRequest = (event) => this.selectionRequest(event)
    this.onApply = (event) => this.apply(event)
    this.onClear = (event) => this.clear(event)
    this.onDelete = (event) => this.delete(event)

    document.addEventListener("diff:selection-request", this.onSelectionRequest)
    document.addEventListener("diff:apply", this.onApply)
    document.addEventListener("diff:clear", this.onClear)
    document.addEventListener("diff:delete", this.onDelete)
  }

  disconnect() {
    document.removeEventListener("diff:selection-request", this.onSelectionRequest)
    document.removeEventListener("diff:apply", this.onApply)
    document.removeEventListener("diff:clear", this.onClear)
    document.removeEventListener("diff:delete", this.onDelete)
  }

  diffStore() {
    return window.quepidStore?.diff || diffStateStore
  }

  snapshotRegistry() {
    const snapshotSearch = window.quepidSearch?.snapshotSearch
    if (!snapshotSearch) return null
    snapshotSearch.snapshots ||= {}
    return snapshotSearch.snapshots
  }

  refreshAllDiffs() {
    return window.quepidSearch?.queryState?.refreshAllDiffs?.() || Promise.reject(new Error("Query diff services are not available"))
  }

  async registerSnapshots(payloads) {
    const { settingsSvc, caseTryNavSvc, fieldSpecSvc, docCacheSvc, normalDocsSvc } = await getSnapshotCapabilities()
    const snapshotSearch = window.quepidSearch?.snapshotSearch
    const registry = this.snapshotRegistry()

    if (!settingsSvc || !caseTryNavSvc || !fieldSpecSvc || !docCacheSvc || !normalDocsSvc || !snapshotSearch || !registry) {
      throw new Error("Snapshot runtime is not available")
    }

    const settings = settingsSvc.editableSettings()
    const useSnapshotScopedCache = settings && Object.keys(settings).length > 0 && (
      settings.searchEngine === "static" || settingsSvc.supportLookupById(settings.searchEngine) === false
    )
    const hydration = registerAndHydrateSnapshots({
      snapshots: payloads,
      registry,
      settings,
      supportsLookupById: settingsSvc.supportLookupById,
      createFieldSpec: fieldSpecSvc.createFieldSpec,
      rootUrl: caseTryNavSvc.getQuepidRootUrl(),
      caseNo: caseTryNavSvc.getCaseNo(),
      addDocIds: ids => docCacheSvc.addIds(ids),
      addScopedDocIds: (ids, scope) => docCacheSvc.addIds(ids, scope),
      clearScopedDocs: scope => docCacheSvc.empty(scope),
      updateDocs: (hydrationSettings, scope) => docCacheSvc.update(hydrationSettings, scope),
      createModel: options => {
        const getDoc = useSnapshotScopedCache
          ? id => docCacheSvc.getDoc(id, options.params.id)
          : options.getDoc

        return snapshotSearch.createSnapshotModel({
          params: options.params,
          getDoc,
          explainDoc: options.explainDoc,
          formatDate: time => new Date(time).toLocaleDateString("en-US"),
          log: options.log
        })
      },
      getDoc: docCacheSvc.getDoc,
      explainDoc: normalDocsSvc.explainDoc,
      formatDate: time => new Date(time).toLocaleDateString("en-US"),
      log: message => console.debug(message)
    })

    await hydration.promise
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
