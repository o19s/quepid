/**
 * Build a CustomEvent `detail` whose snapshot fields are computed on first read.
 *
 * Stores publish a `change` for every query that finishes searching, and a full
 * snapshot is O(queries). Building one per event made loading a large case
 * O(queries^2) even though nearly every listener only reads `queryId`.
 *
 * `extra` fields are plain values. `keys` are the snapshot fields exposed as
 * enumerable getters, so spreading or matching the detail still sees them. The
 * snapshot is taken at first read, not at dispatch time.
 */
export function lazyDetail(keys, build, extra = {}) {
  let snapshot
  const resolve = () => (snapshot ??= build())
  const detail = { ...extra }

  keys
    .filter((key) => !(key in extra))
    .forEach((key) => {
      Object.defineProperty(detail, key, { enumerable: true, get: () => resolve()[key] })
    })

  return detail
}
