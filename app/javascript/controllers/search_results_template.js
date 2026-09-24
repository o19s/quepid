/**
 * Static shell for an expanded query.
 *
 * Stimulus owns this shell and the document list. The small Angular controls
 * that still depend on live Query objects are isolated under
 * `data-angular-deferred` islands. These are the remaining live-query tools that
 * still need Angular-owned Query objects. The expanded-results read path,
 * footer, errors, and pagination controls are Stimulus-owned.
 */
export function searchResultsTemplate({ caseId, queryId, queryExplainData, queryOptionsData = "{}" }) {
  return `
    <div data-controller="search-results">
      <div data-search-results-target="content" class="sub-results container-fluid d-none">
        <div data-search-results-target="scoreAll"></div>

        <div class="btn-toolbar" role="toolbar">
          <div class="btn-group me-2">
            <button class="btn btn-outline-secondary btn-sm" data-action="click->search-results#copyQuery">
              <i class="bi bi-copy" aria-hidden="true" title="Copy query" alt="Copy query"></i>
            </button>
          </div>
          <div class="btn-group me-2">
            <button class="btn btn-outline-secondary btn-sm" data-action="click->search-results#toggleNotes">Toggle Notes</button>
          </div>
          <div class="btn-group me-2">
            <div data-controller="query-explain" data-query-explain-data-value="${queryExplainData}"></div>
          </div>
          <div data-angular-deferred class="d-flex">
            <div class="btn-group me-2">
              <button class="btn btn-outline-secondary btn-sm" ng-controller="TargetedSearchCtrl" ng-click="targetedSearch.triggerModal()">Missing Documents</button>
            </div>
            <div class="btn-group me-2">
              <button class="btn btn-outline-secondary btn-sm" data-controller="query-options-core" data-query-options-core-query-id-value="${queryId}" data-query-options-core-save-url-value="api/cases/${caseId}/queries/${queryId}/options" data-query-options-core-options-value="${queryOptionsData}" data-bs-toggle="modal" data-bs-target="#queryOptionsModal" data-action="click->query-options-core#open">Set Options</button>
            </div>
          </div>
          <div class="btn-group">
            <button class="btn btn-warning btn-sm" data-controller="move-query-core" data-move-query-core-query-id-value="${queryId}" data-move-query-core-case-id-value="${caseId}" data-bs-toggle="modal" data-bs-target="#moveQueryModal" data-action="click->move-query-core#open">Move Query</button>
            <button class="btn btn-danger btn-sm" data-controller="query-delete" data-query-delete-query-id-value="${queryId}" data-query-delete-delete-url-value="api/cases/${caseId}/queries/${queryId}" data-action="click->query-delete#remove">Delete Query</button>
          </div>
        </div>

        <div class="notes-box d-none" data-search-results-target="notesBox">
          <div class="notes-content" data-controller="query-notes" data-query-notes-url-value="api/cases/${caseId}/queries/${queryId}/notes">
            <form data-action="submit->query-notes#save">
              <div class="row mb-3"><label for="information-${queryId}" class="col-sm-2 col-form-label text-sm-end">Information Need</label><div class="col-sm-10"><input type="text" data-query-notes-target="informationNeed" class="form-control" id="information-${queryId}" placeholder="Info Need:"></div></div>
              <div class="row mb-3"><label for="notes-${queryId}" class="col-sm-2 col-form-label text-sm-end">Notes on this Query</label><div class="col-sm-10"><textarea data-query-notes-target="notes" id="notes-${queryId}" class="form-control"></textarea></div></div>
              <div class="row mb-3"><div class="col-sm-offset-2 offset-sm-2 col-sm-10"><button type="submit" class="btn btn-primary">Save</button></div></div>
            </form>
          </div>
        </div>

        <div data-search-results-target="diffResults"></div>
        <div data-search-results-target="error" class="alert alert-danger d-none" role="alert"></div>
        <div data-search-results-target="footer" class="row results-pane-footer d-none">
          <i class="bi bi-caret-up-fill results-pane-toggle" data-action="click->search-results#collapse" data-controller="bs-popover" data-bs-popover-content-value="Close the results pane"></i>
          <button type="button" class="btn btn-outline-secondary d-none" data-search-results-target="nextPage" data-action="click->search-results#paginate">Peek at the next page of results</button>
          <div data-search-results-target="browseTool"></div>
          <div data-search-results-target="depthNote" class="alert alert-warning mb-0 d-none" role="alert"><strong>Note:</strong> Only the top <span data-search-results-target="depthValue"></span> results are used in the scoring calculations.</div>
          <div data-search-results-target="ratedNote" class="alert alert-warning mb-0 d-none" role="alert"><strong>Note:</strong> You are only viewing documents that have been rated</div>
        </div>

        <div data-search-results-target="results"></div>
      </div>
    </div>
  `
}
