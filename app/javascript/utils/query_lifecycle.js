/**
 * Request contracts for the core query lifecycle.
 *
 * The case workspace still uses Angular's $http adapter for now, but endpoint
 * paths and payloads belong here so the eventual Stimulus query store can use
 * the same API without copying the legacy service's conventions.
 */
export function bootstrapRequest(caseId) {
  return {
    method: "GET",
    url: `api/cases/${caseId}/queries`,
    params: { bootstrap: true }
  }
}

export function createRequest(caseId, queryText) {
  return {
    method: "POST",
    url: `api/cases/${caseId}/queries`,
    data: { query: { query_text: queryText } }
  }
}

export function bulkCreateRequest(caseId, queryTexts) {
  return {
    method: "POST",
    url: `api/bulk/cases/${caseId}/queries`,
    data: { queries: queryTexts }
  }
}

export function positionRequest(caseId, queryId, previousQueryId, reverse) {
  return {
    method: "PUT",
    url: `api/cases/${caseId}/queries/${queryId}/position`,
    data: { after: previousQueryId, reverse }
  }
}

export function deleteRequest(caseId, queryId) {
  return {
    method: "DELETE",
    url: `api/cases/${caseId}/queries/${queryId}`
  }
}

export function moveRequest(query, targetCaseId) {
  return {
    method: "PUT",
    url: `api/cases/${query.caseNo}/queries/${query.queryId}`,
    data: { other_case_id: targetCaseId }
  }
}
