// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('api/fetch', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('utils/quepid_root', () => ({
  getQuepidRootUrl: vi.fn(() => ''),
  buildApiUrl: vi.fn((_root, ...parts) => `/api/${parts.join('/')}`),
}));

import { apiFetch } from 'api/fetch';
import { openDetailModal, fetchDetailFields } from 'utils/detail_modal';

function buildDocumentCard(docId, fields = null) {
  const card = document.createElement('div');
  card.className = 'document-card';
  card.dataset.docId = docId;
  if (fields) {
    card.dataset.docFields = JSON.stringify(fields);
  }
  const btn = document.createElement('button');
  btn.dataset.resultsDetailsTrigger = '';
  card.appendChild(btn);
  return { card, btn };
}

function buildModal() {
  const modalEl = document.createElement('div');
  modalEl.id = 'document-detail-modal';
  const title = document.createElement('h5');
  const fieldsList = document.createElement('div');
  const jsonPre = document.createElement('pre');
  const copyJsonBtn = document.createElement('button');
  const viewSourceBtn = document.createElement('button');
  viewSourceBtn.classList.add('d-none');

  return {
    modalEl,
    targets: { title, fieldsList, jsonPre, copyJsonBtn, viewSourceBtn },
  };
}

describe('detail_modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock bootstrap.Modal
    window.bootstrap = {
      Modal: {
        getOrCreateInstance: vi.fn(() => ({ show: vi.fn() })),
      },
    };
  });

  // ── openDetailModal ───────────────────────────────────────────────

  describe('openDetailModal', () => {
    it('populates title and fields from data-doc-fields attribute', async () => {
      const fields = { title: 'My Document', author: 'Jane', year: 2024 };
      const { card, btn } = buildDocumentCard('doc1', fields);
      document.body.appendChild(card);
      const { modalEl, targets } = buildModal();

      const docId = await openDetailModal({
        triggerEl: btn,
        modalEl,
        targets,
        caseId: 1,
        tryNumber: 2,
        queryId: 3,
      });

      expect(docId).toBe('doc1');
      expect(targets.title.textContent).toContain('My Document');

      // Fields list should contain a <dl> with the field keys
      const dl = targets.fieldsList.querySelector('dl');
      expect(dl).not.toBeNull();
      const dts = dl.querySelectorAll('dt');
      expect(dts).toHaveLength(3);
      expect(dts[0].textContent).toBe('title');
      expect(dts[1].textContent).toBe('author');
      expect(dts[2].textContent).toBe('year');

      document.body.removeChild(card);
    });

    it('uses docId as title when no title/name field exists', async () => {
      const fields = { score: 0.95 };
      const { card, btn } = buildDocumentCard('abc-123', fields);
      document.body.appendChild(card);
      const { modalEl, targets } = buildModal();

      await openDetailModal({
        triggerEl: btn,
        modalEl,
        targets,
        caseId: 1,
        tryNumber: 2,
        queryId: 3,
      });

      expect(targets.title.textContent).toContain('abc-123');
      document.body.removeChild(card);
    });

    it('fetches fields on demand when data-doc-fields is not set', async () => {
      const { card, btn } = buildDocumentCard('doc2');
      document.body.appendChild(card);
      const { modalEl, targets } = buildModal();

      apiFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ docs: [{ id: 'doc2', fields: { name: 'Fetched Doc' } }] }),
      });

      await openDetailModal({
        triggerEl: btn,
        modalEl,
        targets,
        caseId: 1,
        tryNumber: 2,
        queryId: 3,
      });

      expect(apiFetch).toHaveBeenCalledOnce();
      expect(targets.title.textContent).toContain('Fetched Doc');
      document.body.removeChild(card);
    });

    it('returns null when triggerEl is not inside a document-card', async () => {
      const orphanBtn = document.createElement('button');
      const { modalEl, targets } = buildModal();

      const result = await openDetailModal({
        triggerEl: orphanBtn,
        modalEl,
        targets,
        caseId: 1,
        tryNumber: 2,
        queryId: 3,
      });

      expect(result).toBeNull();
    });

    it('returns null when modalEl is null', async () => {
      const { card, btn } = buildDocumentCard('doc1', { title: 'Test' });
      document.body.appendChild(card);

      const result = await openDetailModal({
        triggerEl: btn,
        modalEl: null,
        targets: {},
        caseId: 1,
        tryNumber: 2,
        queryId: 3,
      });

      expect(result).toBeNull();
      document.body.removeChild(card);
    });

    it('populates JSON in <pre> when CodeMirror is not available', async () => {
      const fields = { title: 'Test' };
      const { card, btn } = buildDocumentCard('doc1', fields);
      document.body.appendChild(card);
      const { modalEl, targets } = buildModal();

      await openDetailModal({
        triggerEl: btn,
        modalEl,
        targets,
        caseId: 1,
        tryNumber: 2,
        queryId: 3,
      });

      const json = JSON.parse(targets.jsonPre.textContent);
      expect(json.id).toBe('doc1');
      expect(json.fields.title).toBe('Test');
      document.body.removeChild(card);
    });

    it('shows "No fields available" when fields are empty', async () => {
      const { card, btn } = buildDocumentCard('doc1', {});
      document.body.appendChild(card);
      const { modalEl, targets } = buildModal();

      // fetchDetailFields returns {} for empty doc-fields
      apiFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ docs: [] }),
      });

      await openDetailModal({
        triggerEl: btn,
        modalEl,
        targets,
        caseId: 1,
        tryNumber: 2,
        queryId: 3,
      });

      expect(targets.fieldsList.textContent).toContain('No fields available');
      document.body.removeChild(card);
    });

    it('calls initJsonTree callback when provided', async () => {
      const fields = { title: 'Test' };
      const { card, btn } = buildDocumentCard('doc1', fields);
      document.body.appendChild(card);
      const { modalEl, targets } = buildModal();
      const initJsonTree = vi.fn();

      await openDetailModal({
        triggerEl: btn,
        modalEl,
        targets,
        caseId: 1,
        tryNumber: 2,
        queryId: 3,
        initJsonTree,
      });

      expect(initJsonTree).toHaveBeenCalledWith(targets.jsonPre);
      document.body.removeChild(card);
    });

    it('sets view source URL on button', async () => {
      const fields = { title: 'Test' };
      const { card, btn } = buildDocumentCard('doc1', fields);
      document.body.appendChild(card);
      const { modalEl, targets } = buildModal();

      await openDetailModal({
        triggerEl: btn,
        modalEl,
        targets,
        caseId: 1,
        tryNumber: 2,
        queryId: 3,
      });

      expect(targets.viewSourceBtn.dataset.viewSourceUrl).toContain('doc1');
      expect(targets.viewSourceBtn.classList.contains('d-none')).toBe(false);
      document.body.removeChild(card);
    });
  });

  // ── fetchDetailFields ─────────────────────────────────────────────

  describe('fetchDetailFields', () => {
    it('returns fields from matching doc', async () => {
      apiFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            docs: [
              { id: 'doc1', fields: { title: 'First' } },
              { id: 'doc2', fields: { title: 'Second' } },
            ],
          }),
      });

      const result = await fetchDetailFields(1, 2, 3, 'doc2');

      expect(result).toEqual({ title: 'Second' });
    });

    it('falls back to first doc when no exact match', async () => {
      apiFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            docs: [{ id: 'other', fields: { title: 'Fallback' } }],
          }),
      });

      const result = await fetchDetailFields(1, 2, 3, 'doc1');

      expect(result).toEqual({ title: 'Fallback' });
    });

    it('returns empty object on non-ok response', async () => {
      apiFetch.mockResolvedValue({ ok: false });

      const result = await fetchDetailFields(1, 2, 3, 'doc1');

      expect(result).toEqual({});
    });

    it('returns empty object when params are missing', async () => {
      const result = await fetchDetailFields(null, 2, 3, 'doc1');

      expect(result).toEqual({});
      expect(apiFetch).not.toHaveBeenCalled();
    });

    it('returns empty object on network error', async () => {
      apiFetch.mockRejectedValue(new Error('Network failure'));

      const result = await fetchDetailFields(1, 2, 3, 'doc1');

      expect(result).toEqual({});
    });

    it('returns empty object when docs array is empty', async () => {
      apiFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ docs: [] }),
      });

      const result = await fetchDetailFields(1, 2, 3, 'doc1');

      expect(result).toEqual({});
    });
  });
});
