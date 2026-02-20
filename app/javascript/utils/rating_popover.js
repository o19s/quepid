/**
 * Shared utility for Bootstrap rating popovers on document cards.
 * Extracted from results_pane_controller.js and query_expand_controller.js
 * to eliminate duplication.
 *
 * @module utils/rating_popover
 */

/**
 * Toggles a Bootstrap rating popover on a trigger element. If a popover
 * already exists for this docId, it toggles visibility. Otherwise, creates
 * a new popover with rating scale buttons.
 *
 * @param {Map<string, bootstrap.Popover>} popoverMap - Map of docId → Popover for disposal tracking
 * @param {Element} triggerEl - The element that was clicked (e.g. rating badge)
 * @param {string} docId - Document ID for this card
 * @param {number[]} scale - Scorer scale (e.g. [0, 1, 2, 3])
 * @param {Object} [labels={}] - Optional scale labels (e.g. { "0": "Not Relevant", "3": "Perfect" })
 */
export function toggleRatingPopover(popoverMap, triggerEl, docId, scale, labels = {}) {
  const existing = popoverMap.get(docId);
  if (existing) {
    existing.toggle();
    return;
  }

  const Popover = window.bootstrap?.Popover;
  if (!Popover) return;

  const content = buildRatingPopoverContent(docId, scale, labels);

  const popover = new Popover(triggerEl, {
    content,
    html: true,
    trigger: 'manual',
    placement: 'left',
    container: 'body',
  });
  popover.show();
  popoverMap.set(docId, popover);
}

/**
 * Builds the DOM content for a rating popover.
 *
 * @param {string} docId - Document ID
 * @param {number[]} scale - Scorer scale
 * @param {Object} [labels={}] - Optional scale labels
 * @returns {HTMLElement} Wrapper div with rating buttons
 */
export function buildRatingPopoverContent(docId, scale, labels = {}) {
  const wrapper = document.createElement('div');
  wrapper.className = 'd-flex flex-wrap gap-1 align-items-center';
  wrapper.dataset.ratingDocId = String(docId);

  (scale || [0, 1, 2, 3]).forEach((value) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-sm btn-outline-primary';
    button.dataset.ratingValue = String(value);
    const label = labels[String(value)];
    if (label) button.title = String(label);
    button.append(String(value));
    if (label) {
      const labelEl = document.createElement('small');
      labelEl.className = 'text-muted';
      labelEl.textContent = ` ${label}`;
      button.appendChild(labelEl);
    }
    wrapper.appendChild(button);
  });

  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'btn btn-sm btn-outline-secondary ms-1';
  clear.dataset.ratingValue = '';
  clear.textContent = 'Clear';
  wrapper.appendChild(clear);

  return wrapper;
}

/**
 * Disposes all popovers in the map and clears it.
 *
 * @param {Map<string, bootstrap.Popover>} popoverMap
 */
export function disposePopovers(popoverMap) {
  popoverMap.forEach((p) => {
    try {
      p.dispose();
    } catch (_e) {
      /* ignore */
    }
  });
  popoverMap.clear();
}
