/**
 * Framework-free document lifecycle for a live Query.
 *
 * The Angular service supplies the live Query object and document factory
 * dependencies, but reset/error/result transitions and publication policy are
 * kept together here so search execution does not depend on service-local
 * helpers.
 */
export function createLiveQueryDocumentsRuntime({
  getFieldSpec,
  createDocList,
  matchFeaturesExplain,
  publish = () => {}
}) {
  function reset(query) {
    query.errorText = ""
    query.resultsReturned = false
    query.docs.length = 0
  }

  function setError(query, errorText) {
    query.errorText = errorText
    publish(query)
  }

  function setDocs(query, newDocs, numFound) {
    query.docs.length = 0
    query.numFound = numFound
    query.resultsReturned = true
    query.errorText = ""
    query.setDirty()

    const docList = createDocList(newDocs, getFieldSpec(), query.ratingsStore, matchFeaturesExplain)

    query.docs = docList.list()

    if (docList.hasErrors()) {
      setError(query, docList.errorMsg())
    }

    query.docsSet = true
    publish(query)

    return docList.hasErrors() ? docList.errorMsg() : false
  }

  return { reset, setError, setDocs, publish }
}
