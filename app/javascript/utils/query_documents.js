/**
 * Build the plain document/query state consumed by QueryDocumentsStore.
 *
 * The live Query remains owned by the live-query runtime, but this
 * read-model contract is independent of framework helpers so the search runtime
 * can publish the same shape into Stimulus.
 */
export function buildQueryDocumentsState({
  query,
  settings = {},
  selectedTry = {},
  ratingScale = {},
  diffs = null,
  documentUrlFor = () => null
}) {
  const fieldSpec = typeof query.fieldSpec === "function" ? query.fieldSpec() : {}

  return {
    fieldSpec: {
      fields: (fieldSpec.fields || []).slice(),
      id: fieldSpec.id,
      title: fieldSpec.title
    },
    docs: query.docs,
    ratedDocs: query.ratedDocs,
    ratedDocsUnsupported: query.ratedDocsUnsupported,
    paginationSupported:
      selectedTry.searchEngine !== "searchapi" ||
      selectedTry.mapperBasedSearchEngineSupportsPagination === true,
    // 2 = results, 3 = snapshot diff (main switched whenever query.diffs was set).
    resultsView: diffs?.searchers?.length ? 3 : 2,
    depthOfRating: query.depthOfRating,
    ratingScale,
    queryRating: query.rating,
    maxDocScore: typeof query.maxDocScore === "function" ? query.maxDocScore() : null,
    browseUrl: typeof query.browseUrl === "function" ? query.browseUrl() : null,
    searchEngine: settings.searchEngine,
    apiMethod: settings.apiMethod,
    mapperBasedSearchEngineName: settings.mapperBasedSearchEngineName,
    browseHeaders: browseHeaders(settings),
    documentUrlFor,
    version: typeof query.version === "function" ? query.version() : null,
    diffs
  }
}

/**
 * A rateable doc's plain fields, without its explain, score or snippets: reading any of those
 * builds the doc's splainer explain tree, which only an expanded query should pay for.
 */
export function plainDocument(doc) {
  return {
    id: doc.id,
    title: doc.title ?? "",
    subs: { ...(doc.subs || {}) },
    thumb: doc.thumb,
    thumb_options: doc.thumb_options,
    image: doc.image,
    image_options: doc.image_options,
    hasThumb: Boolean(doc.hasThumb?.()),
    hasImage: Boolean(doc.hasImage?.()),
    embeds: { ...(doc.embeds || {}) },
    translations: { ...(doc.translations || {}) },
    unabridgeds: { ...(doc.unabridgeds || {}) },
    rawFields: doc.doc?.origin?.() || {},
    error: doc.error,
    rating: doc.hasRating?.() ? doc.getRating?.() : null
  }
}

/**
 * Plain queries for bulk actions (detailed CSV, frog report), read from the live queries when
 * the action runs. The documents store only holds expanded queries' docs.
 * Pass `withDocs: false` when only doc counts are needed; `docs` is then the live list.
 */
export function bulkActionQueries(liveQueries, { withDocs = true } = {}) {
  return Object.values(liveQueries || {}).map((query) => {
    const fieldSpec = typeof query.fieldSpec === "function" ? query.fieldSpec() : {}
    return {
      queryId: query.queryId,
      queryText: query.queryText,
      fieldSpec: {
        fields: (fieldSpec.fields || []).slice(),
        id: fieldSpec.id,
        title: fieldSpec.title
      },
      depthOfRating: query.depthOfRating,
      allRated: query.currentScore?.allRated ?? false,
      missingRatings: query.currentScore?.countMissingRatings ?? null,
      docs: withDocs ? (query.docs || []).map(plainDocument) : query.docs || []
    }
  })
}

function browseHeaders(settings) {
  let headers = settings.customHeaders
  if (typeof headers === "string") {
    try {
      headers = JSON.parse(headers)
    } catch {
      headers = {}
    }
  }
  headers = headers && typeof headers === "object" && !Array.isArray(headers) ? { ...headers } : {}
  if (settings.basicAuthCredential) {
    headers.Authorization = `Basic ${window.btoa(settings.basicAuthCredential)}`
  }
  return headers
}
