/**
 * Shared utility for the document detail modal (fields + raw JSON view).
 * Extracted from results_pane_controller.js.
 *
 * @module utils/detail_modal
 */
import { apiFetch } from 'api/fetch';
import { getQuepidRootUrl, buildApiUrl } from 'utils/quepid_root';

/**
 * Opens the document detail modal, populating it with the document's fields.
 * Reads fields from the card's data-doc-fields attribute when available,
 * otherwise fetches them on-demand from the search API.
 *
 * @param {Object} opts
 * @param {Element} opts.triggerEl       - The button/element that was clicked
 * @param {Element} opts.modalEl         - The Bootstrap modal DOM element
 * @param {Object} opts.targets          - Named DOM elements for populating the modal:
 * @param {Element} [opts.targets.title]       - Modal title element
 * @param {Element} [opts.targets.fieldsList]  - Container for the <dl> fields list
 * @param {Element} [opts.targets.jsonPre]     - Fallback <pre> for JSON display
 * @param {Element} [opts.targets.jsonTextarea] - CodeMirror textarea for JSON
 * @param {Element} [opts.targets.viewSourceBtn] - "View source" button
 * @param {Element} [opts.targets.copyJsonBtn]   - "Copy JSON" button
 * @param {number} opts.caseId
 * @param {number} opts.tryNumber
 * @param {number} opts.queryId
 * @param {Function} [opts.initJsonTree] - Optional callback to init a json-tree on the pre element
 * @returns {Promise<string|null>} The docId that was opened, or null on failure
 */
export async function openDetailModal({
  triggerEl,
  modalEl,
  targets = {},
  caseId,
  tryNumber,
  queryId,
  initJsonTree,
} = {}) {
  const card = triggerEl?.closest('.document-card');
  if (!card || !modalEl) return null;

  const docId = card.dataset.docId || 'Unknown';
  let fields = {};

  if (card.dataset.docFields) {
    try {
      fields = JSON.parse(card.dataset.docFields);
    } catch (_e) {
      /* ignore parse errors */
    }
  }

  if (Object.keys(fields).length === 0) {
    fields = await fetchDetailFields(caseId, tryNumber, queryId, docId);
  }

  // Populate title
  if (targets.title) {
    const title = fields.title || fields.name || docId;
    const displayTitle = Array.isArray(title) ? title[0] : title;
    targets.title.textContent = `Document: ${displayTitle}`;
  }

  // Populate fields list as <dl>
  if (targets.fieldsList) {
    const keys = Object.keys(fields);
    if (keys.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'text-muted';
      empty.textContent = 'No fields available.';
      targets.fieldsList.replaceChildren(empty);
    } else {
      const dl = document.createElement('dl');
      dl.className = 'row mb-0';
      keys.forEach((key) => {
        const value = fields[key];
        const dt = document.createElement('dt');
        dt.className = 'col-sm-3 text-truncate';
        dt.title = String(key);
        dt.textContent = String(key);
        const dd = document.createElement('dd');
        dd.className = 'col-sm-9';
        if (typeof value === 'object' && value !== null) {
          const pre = document.createElement('pre');
          pre.className = 'mb-0 small bg-light p-2 rounded';
          pre.textContent = JSON.stringify(value, null, 2);
          dd.appendChild(pre);
        } else {
          dd.textContent = String(value ?? '');
        }
        dl.appendChild(dt);
        dl.appendChild(dd);
      });
      targets.fieldsList.replaceChildren(dl);
    }
  }

  // Populate raw JSON tab
  const fullDoc = { id: docId, fields };
  const jsonStr = JSON.stringify(fullDoc, null, 2);

  if (targets.jsonTextarea && window.CodeMirror) {
    const textarea = targets.jsonTextarea;
    if (textarea.editor) {
      textarea.editor.setValue(jsonStr);
      if (textarea.editor.formatJSON) textarea.editor.formatJSON();
    } else {
      textarea.value = jsonStr;
      window.CodeMirror.fromTextArea(textarea, {
        mode: 'json',
        readOnly: true,
        lineNumbers: true,
        height: 400,
      });
    }
    if (targets.jsonPre) targets.jsonPre.classList.add('d-none');
  } else if (targets.jsonPre) {
    targets.jsonPre.textContent = jsonStr;
    targets.jsonPre.classList.remove('d-none');
    if (initJsonTree) initJsonTree(targets.jsonPre);
  }

  // Copy JSON button
  if (targets.copyJsonBtn) {
    targets.copyJsonBtn.setAttribute('data-clipboard-text-value', jsonStr);
  }

  // View source button
  if (targets.viewSourceBtn) {
    const root = getQuepidRootUrl();
    const rawUrl = `${buildApiUrl(root, 'cases', caseId, 'tries', tryNumber, 'queries', queryId, 'search', 'raw')}?doc_id=${encodeURIComponent(docId)}`;
    targets.viewSourceBtn.dataset.viewSourceUrl = rawUrl;
    targets.viewSourceBtn.classList.remove('d-none');
  }

  // Show modal
  const Modal = window.bootstrap?.Modal;
  if (Modal) {
    Modal.getOrCreateInstance(modalEl).show();
  }

  return docId;
}

/**
 * Fetches full document fields from the search API for the detail modal.
 *
 * @param {number} caseId
 * @param {number} tryNumber
 * @param {number} queryId
 * @param {string} docId
 * @returns {Promise<Object>} Document fields object, or {} on failure
 */
export async function fetchDetailFields(caseId, tryNumber, queryId, docId) {
  if (!caseId || !tryNumber || !queryId) return {};

  try {
    const root = getQuepidRootUrl();
    const base = buildApiUrl(
      root,
      'cases',
      caseId,
      'tries',
      tryNumber,
      'queries',
      queryId,
      'search'
    );
    const params = new URLSearchParams({ q: docId, rows: '10', start: '0' });
    const url = `${base}?${params.toString()}`;
    const res = await apiFetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return {};
    const data = await res.json().catch(() => ({}));
    const docs = Array.isArray(data.docs) ? data.docs : [];
    if (docs.length === 0) return {};

    const exact = docs.find((d) => String(d?.id) === String(docId)) || docs[0];
    return exact?.fields || {};
  } catch (_e) {
    return {};
  }
}
