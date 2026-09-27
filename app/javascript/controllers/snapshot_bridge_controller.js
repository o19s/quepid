import { Controller } from "@hotwired/stimulus"
import { deleteSnapshot, fetchSnapshot } from "utils/snapshot_api"
import { diffStateStore } from "stores/diff_state_store"
import { registerAndHydrateSnapshots } from "utils/snapshot_hydration"

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

  injector() {
    return window.angular?.element(document.body)?.injector?.()
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

  async registerSnapshots(payloads) {
    const injector = this.injector()
    const settingsSvc = injector?.get("settingsSvc")
    const caseTryNavSvc = injector?.get("caseTryNavSvc")
    const fieldSpecSvc = injector?.get("fieldSpecSvc")
    const docCacheSvc = injector?.get("docCacheSvc")
    const normalDocsSvc = injector?.get("normalDocsSvc")
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

  apply(event) {
    const detail = event.detail || {}
    const injector = this.injector()
    const queries = injector?.get("queriesSvc")
    const selections = detail.selections || []

    if (!queries || !detail.snapshotsUrl) {
      detail.done?.("Snapshot comparison services are not available")
      return
    }

    Promise.all(selections.map((snapshotId) => fetchSnapshot(`${detail.snapshotsUrl}/${encodeURIComponent(snapshotId)}`)))
      .then((payloads) => this.registerSnapshots(payloads))
      .then(() => {
        this.diffStore().enable(selections)
        this.inAngular(() => {
          return queries.refreshAllDiffs()
        }, detail.done)
      })
      .catch((error) => detail.done?.(error))
  }

  clear(event) {
    const detail = event.detail || {}
    const injector = this.injector()
    const queries = injector?.get("queriesSvc")

    if (!queries) {
      detail.done?.("Angular query services are not available")
      return
    }

    this.inAngular(() => {
      this.diffStore().disable()
      return queries.refreshAllDiffs()
    }, detail.done)
  }

  delete(event) {
    const detail = event.detail || {}
    const injector = this.injector()
    const queries = injector?.get("queriesSvc")
    if (!queries || !detail.snapshotsUrl) {
      detail.done?.("Snapshot comparison services are not available")
      return
    }

    deleteSnapshot(detail.snapshotsUrl, detail.snapshotId)
      .then(() => {
        const registry = this.snapshotRegistry()
        if (registry) delete registry[String(detail.snapshotId)]
        this.inAngular(() => {
          this.diffStore().disable()
          return queries.refreshAllDiffs()
        }, detail.done)
      })
      .catch((error) => detail.done?.(error))
  }

  inAngular(operation, done) {
    const injector = this.injector()
    const rootScope = injector?.get("$rootScope")

    if (!rootScope) {
      done?.("Angular root scope is not available")
      return
    }

    rootScope.$evalAsync(() => {
      try {
        Promise.resolve(operation()).then(() => done?.(null), (error) => done?.(error))
      } catch (error) {
        done?.(error)
      }
    })
  }
}
