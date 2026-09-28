/**
 * Owns live Query execution objects while the collection store owns their
 * membership and display order.
 *
 * The registry is deliberately framework-free: Angular supplies the Query
 * objects, while the store receives the collection mutations needed by the
 * modern case workspace.
 */
export function createLiveQueryRegistry({ store = null } = {}) {
  const queries = {}

  function clear({ resetStore = false } = {}) {
    Object.keys(queries).forEach((queryId) => delete queries[queryId])
    if (resetStore) store?.reset()
  }

  function replace(nextQueries = {}) {
    clear()
    Object.assign(queries, nextQueries)
  }

  function register(queryId, query, { publish = true } = {}) {
    queries[queryId] = query
    if (publish) store?.upsert(query)
    return query
  }

  function get(queryId) {
    return queries[queryId] || queries[String(queryId)] || null
  }

  function remove(queryId) {
    const key = String(queryId)
    if (!queries[key] && !queries[queryId]) return false
    delete queries[key]
    if (key !== String(queryId)) delete queries[queryId]
    store?.remove(queryId)
    return true
  }

  function all() {
    if (store && store.status !== "idle") {
      const ordered = {}
      store.orderedQueryIds().forEach((queryId) => {
        const query = get(queryId)
        if (query) ordered[String(queryId)] = query
      })
      if (Object.keys(ordered).length === Object.keys(queries).length) return ordered
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
