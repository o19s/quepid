/**
 * Shared utility for fetching and parsing server-rendered search results.
 * Extracted from results_pane_controller.js to be reusable by both the
 * results pane and inline query expand controllers.
 *
 * @module utils/results_fetcher
 */
import { apiFetch } from 'api/fetch';
import { getQuepidRootUrl, buildApiQuerySearchUrl } from 'utils/quepid_root';

/**
 * Fetches server-rendered HTML results for a query.
 *
 * @param {Object} opts
 * @param {number} opts.caseId
 * @param {number} opts.tryNumber
 * @param {number} opts.queryId
 * @param {number} [opts.rows=10]        - Number of results per page
 * @param {number} [opts.start=0]        - Offset for pagination
 * @param {string[]} [opts.diffSnapshotIds=[]] - Snapshot IDs for diff mode
 * @param {boolean} [opts.showOnlyRated=false] - Filter to rated-only results
 * @returns {Promise<Response>} The raw fetch Response (caller checks .ok)
 */
export async function fetchResultsHtml({
  caseId,
  tryNumber,
  queryId,
  rows = 10,
  start = 0,
  diffSnapshotIds = [],
  showOnlyRated = false,
} = {}) {
  let url = buildApiQuerySearchUrl(
    getQuepidRootUrl(),
    caseId,
    tryNumber,
    queryId,
    null,
    rows,
    start
  );

  if (diffSnapshotIds.length > 0) {
    const sep = url.includes('?') ? '&' : '?';
    const diffParams = diffSnapshotIds
      .map((id) => `diff_snapshot_ids[]=${encodeURIComponent(id)}`)
      .join('&');
    url = `${url}${sep}${diffParams}`;
  }

  if (showOnlyRated) {
    const sep = url.includes('?') ? '&' : '?';
    url = `${url}${sep}show_only_rated=true`;
  }

  return apiFetch(url, {
    method: 'GET',
    headers: { Accept: 'text/html' },
  });
}

/**
 * Parses the HTML response from fetchResultsHtml into structured pieces.
 *
 * The server wraps results in:
 *   <div data-results-pane-html-response data-num-found="..." data-shown="...">
 *     <p class="text-muted small mb-2">X results found</p>
 *     <div class="document-card">...</div>  (repeated)
 *     <div data-results-pane-target="loadMoreArea">...</div>
 *   </div>
 *
 * @param {string} htmlText - Raw HTML string from the server
 * @returns {{ numFound: number, headerEl: Element|null, cards: Element[], loadMoreEl: Element|null }}
 */
export function parseResultsHtml(htmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');
  const wrapper = doc.querySelector('[data-results-pane-html-response]');

  if (!wrapper) {
    return { numFound: 0, headerEl: null, cards: [], loadMoreEl: null };
  }

  const numFound = parseInt(wrapper.dataset.numFound || '0', 10);
  const headerEl = wrapper.querySelector('p.text-muted.small.mb-2');
  const cards = Array.from(wrapper.querySelectorAll('.document-card'));
  const loadMoreEl = wrapper.querySelector("[data-results-pane-target='loadMoreArea']");

  return { numFound, headerEl, cards, loadMoreEl };
}
