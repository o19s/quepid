/**
 * Provides the live Query execution accessor while the collection store owns
 * the objects, membership, display order, and read-model snapshots.
 */
export function createLiveQueryRegistry({ store = null } = {}) {
  const queries = {}

  function clear({ resetStore = false } = {}) {
    Object.keys(queries).forEach((queryId) => delete queries[queryId])
    store?.clearLiveQueries?.()
    if (resetStore) store?.reset()
  }

  function replace(nextQueries = {}) {
    clear()
    if (store?.replaceLiveQueries) store.replaceLiveQueries(nextQueries)
    else Object.assign(queries, nextQueries)
  }

  function register(queryId, query, { publish = true } = {}) {
    if (store?.liveQuery) {
      store.upsert(query, { publish })
    } else {
      queries[queryId] = query
      if (publish) store?.upsert?.(query)
    }
    return query
  }

  function get(queryId) {
    return store?.liveQuery?.(queryId) || queries[queryId] || queries[String(queryId)] || null
  }

  function remove(queryId) {
    const key = String(queryId)
    const query = get(queryId)
    if (!query) return false
    delete queries[key]
    if (key !== String(queryId)) delete queries[queryId]
    store?.remove?.(queryId)
    return true
  }

  function all() {
    if (store && store.status !== "idle") {
      const ordered = {}
      store.orderedQueryIds().forEach((queryId) => {
        const query = get(queryId)
        if (query) ordered[String(queryId)] = query
      })
      if (
        Object.keys(ordered).length === (store?.size ?? Object.keys(queries).length)
      ) {
        return ordered
      }
    }
    return queries
  }

  return {
    all,
    clear,
    get,
    raw: () => queries,
    register,
    remove,
    replace
  }
}
