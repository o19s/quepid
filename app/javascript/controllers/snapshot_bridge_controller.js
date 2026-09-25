import { Controller } from "@hotwired/stimulus"

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

  selectionRequest(event) {
    const injector = this.injector()
    const queryView = injector?.get("queryViewSvc")
    event.detail?.done?.(queryView?.getAllDiffSettings?.() || [])
  }

  apply(event) {
    const detail = event.detail || {}
    const injector = this.injector()
    const queryView = injector?.get("queryViewSvc")
    const queries = injector?.get("queriesSvc")
    const snapshots = injector?.get("querySnapshotSvc")
    const selections = detail.selections || []

    if (!queryView || !queries || !snapshots) {
      detail.done?.("Angular snapshot services are not available")
      return
    }

    Promise.all(selections.map((snapshotId) => snapshots.get(snapshotId)))
      .then(() => {
        this.inAngular(() => {
          queryView.enableDiffs(selections)
          return queries.refreshAllDiffs()
        }, detail.done)
      })
      .catch((error) => detail.done?.(error))
  }

  clear(event) {
    const detail = event.detail || {}
    const injector = this.injector()
    const queryView = injector?.get("queryViewSvc")
    const queries = injector?.get("queriesSvc")

    if (!queryView || !queries) {
      detail.done?.("Angular query services are not available")
      return
    }

    this.inAngular(() => {
      queryView.disableComparisons()
      return queries.refreshAllDiffs()
    }, detail.done)
  }

  delete(event) {
    const detail = event.detail || {}
    const injector = this.injector()
    const queryView = injector?.get("queryViewSvc")
    const queries = injector?.get("queriesSvc")
    const snapshots = injector?.get("querySnapshotSvc")

    if (!queryView || !queries || !snapshots) {
      detail.done?.("Angular snapshot services are not available")
      return
    }

    Promise.resolve(snapshots.deleteSnapshot(detail.snapshotId))
      .then(() => {
        this.inAngular(() => {
          queryView.disableComparisons()
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
