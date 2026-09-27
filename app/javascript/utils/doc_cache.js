export function createDocCache({ resolver, proxyUrlFor, log = console }) {
  let resolveDocs = resolver
  let docCache = {}
  const scopedDocCaches = {}

  const cacheFor = (scope) => {
    if (scope === undefined || scope === null) return docCache

    const scopeKey = String(scope)
    scopedDocCaches[scopeKey] ||= {}
    return scopedDocCaches[scopeKey]
  }

  const addIds = (ids, scope) => {
    const cache = cacheFor(scope)
    ids.forEach((id) => {
      if (!Object.prototype.hasOwnProperty.call(cache, id)) cache[id] = null
    })
  }

  const getDoc = (id, scope) => cacheFor(scope)[id]
  const knowsDoc = (id, scope) => Object.prototype.hasOwnProperty.call(cacheFor(scope), id)
  const hasDoc = (id, scope) => knowsDoc(id, scope) && getDoc(id, scope) !== null

  const empty = (scope) => {
    if (scope === undefined || scope === null) {
      docCache = {}
    } else {
      delete scopedDocCaches[String(scope)]
    }
  }

  const invalidate = (scope) => {
    const cache = cacheFor(scope)
    Object.keys(cache).forEach((docId) => {
      cache[docId] = null
    })
  }

  const update = (settings, scope) => {
    const cache = cacheFor(scope)
    const docIds = Object.keys(cache).filter((docId) => cache[docId] === null)
    if (!docIds.length) return Promise.resolve()

    const resolvedSettings = { ...settings }
    if (resolvedSettings.proxyRequests === true) {
      resolvedSettings.proxyUrl = proxyUrlFor(resolvedSettings.searchEndpointId)
    }

    const documentResolver = resolveDocs(docIds, resolvedSettings, 15)
    return documentResolver
      .fetchDocs()
      .then(() => {
        Object.values(documentResolver.docs || {}).forEach((doc) => {
          cache[doc.id] = doc
        })
      })
      .catch((error) => {
        log.info?.("Error fetching docs in doc cache:", error)
        return error
      })
  }

  const setResolver = (nextResolver) => {
    resolveDocs = nextResolver
  }

  return { addIds, getDoc, hasDoc, knowsDoc, empty, invalidate, update, setResolver }
}
