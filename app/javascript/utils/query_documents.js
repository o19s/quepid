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
