import { Controller } from "@hotwired/stimulus"
import { deleteSnapshot, fetchSnapshot } from "utils/snapshot_api"
import { diffStateStore } from "stores/diff_state_store"

/*
 * Temporary compatibility bridge for snapshot comparison.
 *
 * The comparison picker and renderer are Stimulus-owned. The live Query model
 * and snapshot scoring are still Angular-owned, so this controller is the
 * single, explicit boundary between them while that larger migration is in
 * progress. Keep the bridge narrow: it owns event wiring, not snapshot or
 * scoring policy.
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

  selectionRequest(event) {
    event.detail?.done?.(this.diffStore().selections())
  }

  apply(event) {
    const detail = event.detail || {}
    const injector = this.injector()
    const queries = injector?.get("queriesSvc")
    const snapshots = injector?.get("querySnapshotSvc")
    const selections = detail.selections || []

    if (!queries || !snapshots || !detail.snapshotsUrl) {
      detail.done?.("Angular snapshot services are not available")
      return
    }

    Promise.all(selections.map((snapshotId) => fetchSnapshot(`${detail.snapshotsUrl}/${encodeURIComponent(snapshotId)}`)))
      .then((payloads) => snapshots.registerSnapshots(payloads))
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
    const snapshots = injector?.get("querySnapshotSvc")

    if (!queries || !snapshots || !detail.snapshotsUrl) {
      detail.done?.("Angular snapshot services are not available")
      return
    }

    deleteSnapshot(detail.snapshotsUrl, detail.snapshotId)
      .then(() => {
        snapshots.removeSnapshot(detail.snapshotId)
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
