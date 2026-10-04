import { getJson, requestJsonResponse } from "api/json"

/**
 * Request contracts for the core query lifecycle.
 *
 * Endpoint paths and payloads belong here so Stimulus and the query runtime
 * use the same API without copying service conventions.
 */

/** Loads the case's queries with their ratings, as the query list bootstraps them. */
export function fetchQueries(caseId) {
  return getJson(`api/cases/${caseId}/queries?bootstrap=true`)
}

// Callers branch on a 204 (no new queries), so these resolve to `{ status, data }`.
async function persist(method, url, json) {
  const { data, status } = await requestJsonResponse(url, { method, json })
  return { status, data }
}

export function persistQuery(caseId, queryText) {
  return persist("POST", `api/cases/${caseId}/queries`, { query: { query_text: queryText } })
}

export function persistQueries(caseId, queryTexts) {
  return persist("POST", `api/bulk/cases/${caseId}/queries`, { queries: queryTexts })
}

export function moveQuery(caseId, queryId, targetCaseId) {
  return persist("PUT", `api/cases/${caseId}/queries/${queryId}`, { other_case_id: targetCaseId })
}
