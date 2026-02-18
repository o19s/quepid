/**
 * DocCache — plain JS document cache.
 *
 * Replaces docCacheSvc for the Stimulus/modern stack. Caches document bodies by id
 * to avoid re-fetching when displaying document cards, expand content, diff, etc.
 *
 * Usage:
 *   import { docCache } from 'modules/doc_cache'
 *   import { getQuepidRootUrl } from 'utils/quepid_root'
 *
 *   docCache.addIds(['1', '2', '3'])
 *   const proxyUrl = settings.proxyRequests ? getQuepidRootUrl() + 'proxy/fetch?url=' : null
 *   await docCache.update(settings, docResolver, proxyUrl)
 *   const doc = docCache.getDoc('1')
 *
 * The docResolver must implement:
 *   createResolver(ids, settings, chunkSize) -> { fetchDocs: () => Promise, docs: Doc[] }
 *
 * In the legacy Angular app, docResolverSvc provides this. For the modern stack,
 * a fetch-based resolver or server doc-lookup endpoint can be used when needed.
 */

const CHUNK_SIZE = 15

/**
 * @typedef {Object} DocResolver
 * @property {function(string[], Object, number): { fetchDocs: () => Promise, docs: Object[] }} createResolver
 */

/**
 * In-memory cache of documents by id.
 */
export class DocCache {
  constructor() {
    /** @type {Record<string, Object|null>} */
    this._cache = {}
  }

  /**
   * Register doc ids to track. Does not fetch; call update() to fetch.
   * @param {string[]} [ids] - Doc ids to track; null/undefined is a no-op (matches docCacheSvc).
   */
  addIds(ids) {
    if (!ids) return
    for (const id of ids) {
      if (!Object.prototype.hasOwnProperty.call(this._cache, id)) {
        this._cache[id] = null
      }
    }
  }

  /**
   * @param {string} id
   * @returns {Object|null|undefined}
   */
  getDoc(id) {
    return this._cache[id]
  }

  /**
   * @param {string} id
   * @returns {boolean}
   */
  hasDoc(id) {
    return this.knowsDoc(id) && this._cache[id] !== null
  }

  /**
   * @param {string} id
   * @returns {boolean}
   */
  knowsDoc(id) {
    return Object.prototype.hasOwnProperty.call(this._cache, id)
  }

  /** Clear all entries. */
  empty() {
    this._cache = {}
  }

  /** Mark all entries as stale (null); next update() will re-fetch. */
  invalidate() {
    for (const id of Object.keys(this._cache)) {
      this._cache[id] = null
    }
  }

  /**
   * Fetch missing docs and populate cache.
   * @param {Object} settings - Search settings (searchUrl, proxyRequests, proxyUrl, etc.)
   * @param {DocResolver} docResolver - Resolver with createResolver(ids, settings, chunkSize)
   * @param {string} [proxyUrl] - Optional proxy URL when settings.proxyRequests is true
   * @returns {Promise<void>}
   */
  async update(settings, docResolver, proxyUrl = null) {
    const idsToFetch = []
    for (const [id, doc] of Object.entries(this._cache)) {
      if (doc === null) {
        idsToFetch.push(id)
      }
    }

    if (idsToFetch.length === 0) {
      return
    }

    const settingsToUse = { ...settings }
    if (settings.proxyRequests === true && proxyUrl) {
      settingsToUse.proxyUrl = proxyUrl
    }

    const resolver = docResolver.createResolver(idsToFetch, settingsToUse, CHUNK_SIZE)
    try {
      await resolver.fetchDocs()
      for (const doc of resolver.docs || []) {
        if (doc && doc.id != null) {
          this._cache[doc.id] = doc
        }
      }
    } catch (response) {
      console.info('Error fetching Docs in DocCache:', response)
      // Match docCacheSvc: resolve (don't reject) so callers can chain without .catch
    }
  }
}

/** Singleton instance for shared use across Stimulus controllers. */
export const docCache = new DocCache()
