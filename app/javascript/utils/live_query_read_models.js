import { escapeHtml } from "utils/html"

const isFunction = (value) => typeof value === "function"

function idFieldHelp(fieldSpecId) {
  return (
    " Quepid requires a unique identifier for each document to work correctly. Open the " +
    "<strong>Tune Relevance</strong> pane, and under <strong>Settings</strong> in the " +
    "<strong>Displayed Fields</strong> field change " +
    `<strong>id:${fieldSpecId}</strong> to specify your unique ID field.`
  )
}

/**
 * Normalizes raw search docs into rateable docs. Docs with a missing or duplicate id get a
 * placeholder id and a per-doc error, and the list reports a case-level error message.
 * Both messages are HTML (rendered through sanitizeHtml); the user-set id field and the
 * engine-supplied doc id are escaped here so safety does not depend on the renderer.
 */
export function createDocList({ docs, fieldSpec, ratingsStore, explain, createNormalDoc }) {
  const normalizedDocs = []
  const ids = []
  const fieldSpecId = escapeHtml(fieldSpec.id)
  let error = ""

  ;(docs || []).forEach((doc, index) => {
    const altExplainJson = explain ? explain(doc) : undefined
    const normalDoc = createNormalDoc(fieldSpec, doc, altExplainJson)
    const rateableDoc = ratingsStore.createRateableDoc(normalDoc)
    if (normalDoc.id === undefined || normalDoc.id === "undefined") {
      error =
        `Your selected id field <strong>${fieldSpecId}</strong> is missing on one or more results.` +
        idFieldHelp(fieldSpecId)
      rateableDoc.error = "ID Field Missing"
      rateableDoc.id = `${rateableDoc.error}${index}`
    } else if (ids.includes(normalDoc.id)) {
      error =
        `Your selected id field <strong>${fieldSpecId}</strong> doesn't uniquely identify individual documents.` +
        idFieldHelp(fieldSpecId)
      rateableDoc.error = `ID <strong>${escapeHtml(normalDoc.id)}</strong> Shared With Another Doc`
      rateableDoc.id = `${rateableDoc.error}${index}`
    }
    normalizedDocs.push(rateableDoc)
    ids.push(normalDoc.id)
  })

  return {
    list: () => normalizedDocs,
    hasErrors: () => error.length > 0,
    errorMsg: () => error
  }
}

/**
 * Link for a result doc: injects basic-auth credentials and prefixes the search endpoint's
 * proxy URL when the try proxies requests. Returns null when the doc has no usable URL.
 */
export function documentUrlFor(doc, { settings = {}, proxyUrlFor } = {}) {
  if (!doc || !isFunction(doc._url)) return null

  let linkUrl
  try {
    linkUrl = doc._url()
  } catch {
    return null
  }
  if (settings.basicAuthCredential) {
    linkUrl = linkUrl.replace("://", "://" + settings.basicAuthCredential + "@")
  }
  if (settings.proxyRequests === true) {
    linkUrl = proxyUrlFor(settings.searchEndpointId) + linkUrl
  }
  return linkUrl
}

/**
 * Snapshot-comparison columns for a query's diff searchers. Under show-only-rated the
 * unfiltered docs are hidden and only the rated docs remain.
 */
export function buildDiffReadModel(query, { showOnlyRated = false } = {}) {
  if (!query || !query.diffs || !isFunction(query.diffs.getSearchers)) {
    return null
  }

  return {
    searchers: query.diffs.getSearchers().map(function (searcher, index) {
      const score = searcher.diffScore || { score: "?", allRated: false }
      const docs = query.diffs.docs(index, false) || []
      const ratedDocs = query.diffs.docs(index, true) || []
      const maxDocScore = docs.reduce(function (max, doc) {
        return Math.max(max, isFunction(doc.score) ? doc.score() : 0)
      }, 0)

      return {
        name: isFunction(searcher.name) ? searcher.name() : "Snapshot",
        version: isFunction(searcher.version) ? searcher.version() : null,
        inError: searcher.inError,
        searchError: searcher.searchError,
        score: score,
        maxDocScore: maxDocScore,
        docs: showOnlyRated ? [] : docs,
        ratedDocs: ratedDocs
      }
    })
  }
}
