/**
 * Provides the live Query execution accessor while the collection store owns
 * the objects, membership, display order, and read-model snapshots.
 */
export function createLiveQueryRegistry({ store }) {
  function clear({ resetStore = false } = {}) {
    store.clearLiveQueries()
    if (resetStore) store.reset()
  }

  function register(queryId, query, { publish = true } = {}) {
    store.upsert(query, { publish })
    return query
  }

  function get(queryId) {
    return store.liveQuery(queryId)
  }

  function remove(queryId) {
    const query = get(queryId)
    if (!query) return false
    store.remove(queryId)
    return true
  }

  function all() {
    const ordered = {}
    store.orderedQueryIds().forEach((queryId) => {
      const query = get(queryId)
      if (query) ordered[String(queryId)] = query
    })
    return ordered
  }

  return {
    all,
    clear,
    get,
    register,
    remove
  }
}
