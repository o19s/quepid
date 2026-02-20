/**
 * Shared utility for bulk rating operations on document cards.
 * Extracted from results_pane_controller.js.
 *
 * @module utils/bulk_rating
 */
import { apiFetch } from 'api/fetch';
import { getQuepidRootUrl, buildApiUrl } from 'utils/quepid_root';

/**
 * Bulk-rate all specified docs for a query.
 *
 * @param {number} caseId
 * @param {number} queryId
 * @param {string[]} docIds - Document IDs to rate
 * @param {number} rating - Rating value to apply
 * @returns {Promise<void>}
 * @throws {Error} If the API call fails
 */
export async function bulkRate(caseId, queryId, docIds, rating) {
  const root = getQuepidRootUrl();
  const url = buildApiUrl(root, 'cases', caseId, 'queries', queryId, 'bulk', 'ratings');

  const res = await apiFetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ doc_ids: docIds, rating }),
  });
  if (!res.ok) throw new Error(`Bulk rate failed (${res.status})`);
}

/**
 * Clear ratings for all specified docs for a query.
 *
 * @param {number} caseId
 * @param {number} queryId
 * @param {string[]} docIds - Document IDs to clear
 * @returns {Promise<void>}
 * @throws {Error} If the API call fails
 */
export async function bulkClear(caseId, queryId, docIds) {
  const root = getQuepidRootUrl();
  const url = buildApiUrl(root, 'cases', caseId, 'queries', queryId, 'bulk', 'ratings', 'delete');

  const res = await apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ doc_ids: docIds }),
  });
  if (!res.ok) throw new Error(`Bulk clear failed (${res.status})`);
}

/**
 * Collect visible document IDs from a container element.
 *
 * @param {Element} container - Element containing .document-card[data-doc-id] children
 * @returns {string[]} Array of document ID strings
 */
export function collectVisibleDocIds(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll('.document-card[data-doc-id]'))
    .map((el) => el.dataset.docId)
    .filter(Boolean);
}
