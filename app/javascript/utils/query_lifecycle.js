import { requestJsonResponse } from "api/json"

/**
 * Request contracts for the core query lifecycle.
 *
 * Endpoint paths and payloads belong here so Stimulus and the query runtime
 * use the same API without copying service conventions.
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

async function persist(request) {
  const { data, status } = await requestJsonResponse(request.url, {
    method: request.method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request.data)
  })

  return { status, data }
}

export function persistQuery(caseId, queryText) {
  return persist(createRequest(caseId, queryText))
}

export function persistQueries(caseId, queryTexts) {
  return persist(bulkCreateRequest(caseId, queryTexts))
}

export function moveQuery(caseId, queryId, targetCaseId) {
  return persist(moveRequest({ caseNo: caseId, queryId }, targetCaseId))
}

export function deleteQuery(caseId, queryId) {
  return persist(deleteRequest(caseId, queryId))
}
