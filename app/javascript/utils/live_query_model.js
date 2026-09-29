import { createQueryModel } from "utils/query_model"

/**
 * Runtime boundary for constructing a live query model.
 *
 * The legacy runtime still owns the compatibility callbacks, but Query construction now
 * depends on one explicit adapter instead of assembling framework callbacks
 * inline. The model itself remains framework-free and reusable by the modern
 * case workspace.
 */
export function createLiveQueryModelRuntime({
  createModel = createQueryModel,
  getDefaultScorer,
  scoreQuery,
  promiseApi,
  getFieldSpec,
  getQueryState: getQueryStateAdapter,
  buildRatingsFilter,
  ratedDocIds,
  onDirty,
  publish
}) {
  return {
    create({ query, ratingsStore, getQueryState = () => getQueryStateAdapter(query) }) {
      return createModel({
        query,
        ratingsStore,
        getDefaultScorer,
        scoreQuery,
        promiseApi,
        getFieldSpec,
        getQueryState,
        buildRatingsFilter,
        ratedDocIds,
        onDirty,
        publish
      })
    }
  }
}
