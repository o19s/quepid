import { createQueryDiff } from "utils/diff_results"

/**
 * Adapter for live Query diff construction and refresh.
 * The service graph supplies the current settings, query collection, and publication
 * callbacks while diff state remains on the live Query objects.
 */
export function createLiveQueryDiffRuntime({
  createDiff = createQueryDiff,
  getQueries,
  getDiffSettings,
  getSettings,
  createSearcherFromSnapshot,
  publish,
  notify
}) {
  const create = (query) =>
    createDiff({
      query,
      diffSettings: getDiffSettings(),
      settings: getSettings(),
      createSearcherFromSnapshot
    })

  return {
    create,

    refreshAll() {
      const refreshes = []
      Object.values(getQueries()).forEach((query) => {
        refreshes.push(create(query))
        publish(query)
      })

      return Promise.all(refreshes).then(
        () => {
          Object.values(getQueries()).forEach((query) => publish(query))
          notify({ success: true })
        },
        (error) => {
          notify({ success: false })
          return Promise.reject(error)
        }
      )
    }
  }
}
