import { apiFetch } from 'api/fetch';
import { getQuepidRootUrl, buildApiUrl } from 'utils/quepid_root';

// Shared utility for applying/clearing individual ratings. Used by both
// results_pane_controller.js (full results pane) and query_expand_controller.js
// (inline preview).

export async function applyRating(caseId, queryId, docId, rating) {
  const root = getQuepidRootUrl();
  const url = buildApiUrl(root, 'cases', caseId, 'queries', queryId, 'ratings');
  const isClear = rating === '' || (typeof rating === 'number' && isNaN(rating));

  if (isClear) {
    const res = await apiFetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ rating: { doc_id: docId } }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.message || 'Failed to clear rating');
    }
    return null;
  } else {
    const res = await apiFetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ rating: { doc_id: docId, rating } }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.message || 'Failed to update rating');
    }
    const data = await res.json().catch(() => ({}));
    return data.rating != null ? data.rating : rating;
  }
}

export function triggerScoreRefresh(caseId, queryId, tryNumber) {
  if (queryId) {
    document.dispatchEvent(
      new CustomEvent('query-score:refresh', {
        detail: { queryId, caseId },
      })
    );
  }

  if (!tryNumber) return;
  // Debounce full evaluation per case/try to avoid duplicate overlapping jobs.
  const timerKey = `${caseId}:${tryNumber}`;
  triggerScoreRefresh._timers ||= new Map();
  triggerScoreRefresh._timerSeq ||= 0;
  const existingTimerState = triggerScoreRefresh._timers.get(timerKey);
  if (existingTimerState) clearTimeout(existingTimerState.timerId);
  const timerSeq = ++triggerScoreRefresh._timerSeq;
  const timer = setTimeout(() => {
    const root = getQuepidRootUrl();
    const url = `${buildApiUrl(root, 'cases', caseId, 'run_evaluation')}?try_number=${encodeURIComponent(tryNumber)}`;
    apiFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    })
      .catch((err) => console.warn('Score refresh trigger failed:', err))
      .finally(() => {
        const currentTimerState = triggerScoreRefresh._timers.get(timerKey);
        if (currentTimerState && currentTimerState.timerSeq === timerSeq) {
          triggerScoreRefresh._timers.delete(timerKey);
        }
      });
  }, 3000);
  triggerScoreRefresh._timers.set(timerKey, { timerId: timer, timerSeq });
}
