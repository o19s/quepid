import { escapeAttribute } from "utils/html"

/**
 * Static shell for an expanded query.
 *
 * Stimulus owns this shell, the document list, and all of the query actions.
 * Live search/scoring remains behind the query-state adapter.
 */
export function searchResultsTemplate({ caseId, queryId, queryExplainData, queryOptionsData = "{}" }) {
  // Raw values in; every interpolation below is escaped here, once.
  caseId = escapeAttribute(caseId)
  queryId = escapeAttribute(queryId)
  queryExplainData = escapeAttribute(queryExplainData)
  queryOptionsData = escapeAttribute(queryOptionsData)
  return `
    <div data-controller="search-results" data-action="rating-popover:rate->search-results#handleRating rating-popover:reset->search-results#handleRating query-row:toggle->search-results#handleQueryToggle search-result:show-document->search-results#handleShowDocument query-notes:close->search-results#closeNotes">
      <div data-search-results-target="content" class="sub-results container-fluid d-none">
        <div data-search-results-target="scoreAll"></div>

        <div class="btn-toolbar" role="toolbar">
          <div class="btn-group me-2">
            <button type="button" class="btn btn-outline-secondary btn-sm" title="Copy query" aria-label="Copy query" data-action="click->search-results#copyQuery">
              <i class="bi bi-copy" aria-hidden="true"></i>
            </button>
          </div>
          <div class="btn-group me-2">
            <button class="btn btn-outline-secondary btn-sm" data-action="click->search-results#toggleNotes">Toggle Notes</button>
          </div>
          <div class="btn-group me-2">
            <div data-controller="query-explain" data-query-explain-data-value="${queryExplainData}"></div>
          </div>
          <div class="d-flex">
            <div class="btn-group me-2">
              <button class="btn btn-outline-secondary btn-sm" data-controller="missing-documents" data-missing-documents-query-id-value="${queryId}" data-action="click->missing-documents#open">Missing Documents</button>
            </div>
            <div class="btn-group me-2">
              <button class="btn btn-outline-secondary btn-sm" data-query-options-core-query-id-value="${queryId}" data-query-options-core-save-url-value="api/cases/${caseId}/queries/${queryId}/options" data-query-options-core-options-value="${queryOptionsData}" data-bs-toggle="modal" data-bs-target="#queryOptionsModal">Set Options</button>
            </div>
          </div>
          <div class="btn-group">
            <button class="btn btn-warning btn-sm" data-move-query-core-query-id-value="${queryId}" data-move-query-core-case-id-value="${caseId}" data-bs-toggle="modal" data-bs-target="#moveQueryModal">Move Query</button>
            <button class="btn btn-danger btn-sm" data-controller="query-delete" data-query-delete-query-id-value="${queryId}" data-query-delete-delete-url-value="api/cases/${caseId}/queries/${queryId}" data-action="click->query-delete#remove">Delete Query</button>
          </div>
        </div>

        <div class="notes-box d-none" data-search-results-target="notesBox">
          <div class="notes-content" data-controller="query-notes" data-action="query-notes:open->query-notes#load" data-query-notes-url-value="api/cases/${caseId}/queries/${queryId}/notes">
            <form data-action="submit->query-notes#save">
              <div class="row mb-3"><label for="information-${queryId}" class="col-sm-2 col-form-label text-sm-end">Information Need</label><div class="col-sm-10"><input type="text" data-query-notes-target="informationNeed" class="form-control" id="information-${queryId}" placeholder="Info Need:"></div></div>
              <div class="row mb-3"><label for="notes-${queryId}" class="col-sm-2 col-form-label text-sm-end">Notes on this Query</label><div class="col-sm-10"><textarea data-query-notes-target="notes" id="notes-${queryId}" class="form-control"></textarea></div></div>
              <div class="row mb-3"><div class="col-sm-offset-2 offset-sm-2 col-sm-10"><button type="submit" class="btn btn-primary">Save</button></div></div>
            </form>
          </div>
        </div>

        <div data-search-results-target="diffResults"></div>
        <div data-search-results-target="error" class="alert alert-danger d-none" role="alert"></div>

        <div data-search-results-target="results"></div>
        <div data-search-results-target="footer" class="row results-pane-footer d-none">
          <button type="button" class="btn btn-link p-0 results-pane-toggle" aria-label="Close the results pane" data-action="click->search-results#collapse" data-controller="bs-popover" data-bs-popover-content-value="Close the results pane">
            <i class="bi bi-caret-up-fill" aria-hidden="true"></i>
          </button>
          <button type="button" class="btn btn-outline-secondary d-none" data-search-results-target="nextPage" data-action="click->search-results#paginate">Peek at the next page of results</button>
          <div data-search-results-target="browseTool"></div>
          <div data-search-results-target="depthNote" class="alert alert-warning mb-0 d-none" role="alert"><strong>Note:</strong> Only the top <span data-search-results-target="depthValue"></span> results are used in the scoring calculations.</div>
          <div data-search-results-target="ratedNote" class="alert alert-warning mb-0 d-none" role="alert"><strong>Note:</strong> You are only viewing documents that have been rated</div>
        </div>
      </div>
    </div>
  `
}
