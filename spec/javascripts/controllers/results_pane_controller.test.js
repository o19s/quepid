// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@hotwired/stimulus', () => ({
  Controller: class {},
}))

vi.mock('api/fetch', () => ({
  apiFetch: vi.fn(),
}))

vi.mock('utils/rating_api', () => ({
  triggerScoreRefresh: vi.fn(),
}))

vi.mock('utils/quepid_root', () => ({
  getQuepidRootUrl: vi.fn(() => ''),
  buildApiUrl: vi.fn((...parts) => `/api/${parts.join('/')}`),
  buildApiQuerySearchUrl: vi.fn(() => '/api/cases/1/tries/1/queries/1/search'),
}))

import { apiFetch } from 'api/fetch'
import { triggerScoreRefresh } from 'utils/rating_api'
import ResultsPaneController from 'controllers/results_pane_controller'

function buildController() {
  const resultsContainerTarget = document.createElement('div')
  const loadingIndicatorTarget = document.createElement('div')
  const errorMessageTarget = document.createElement('div')
  const errorTextTarget = document.createElement('div')
  const diffIndicatorTarget = document.createElement('div')
  const detailModalTarget = document.createElement('div')
  const detailModalTitleTarget = document.createElement('h5')
  const detailFieldsListTarget = document.createElement('div')
  const detailJsonPreTarget = document.createElement('pre')
  const detailJsonTextareaTarget = document.createElement('textarea')
  const ratingAnnouncementTarget = document.createElement('div')
  const bulkRatingBarTarget = document.createElement('div')

  const controller = Object.create(ResultsPaneController.prototype)
  Object.assign(controller, {
    caseIdValue: 1,
    hasCaseIdValue: true,
    tryNumberValue: 1,
    hasTryNumberValue: true,
    queryIdValue: 1,
    hasQueryIdValue: true,
    queryTextValue: 'test query',
    scaleValue: [0, 1, 2, 3],
    scaleLabelsValue: {},
    skipFetchValue: false,
    hasSkipFetchValue: true,
    hasResultsContainerTarget: true,
    resultsContainerTarget,
    hasLoadingIndicatorTarget: true,
    loadingIndicatorTarget,
    hasErrorMessageTarget: true,
    errorMessageTarget,
    hasErrorTextTarget: true,
    errorTextTarget,
    hasDiffIndicatorTarget: true,
    diffIndicatorTarget,
    hasDetailModalTarget: true,
    detailModalTarget,
    hasDetailModalTitleTarget: true,
    detailModalTitleTarget,
    hasDetailFieldsListTarget: true,
    detailFieldsListTarget,
    hasDetailJsonPreTarget: true,
    detailJsonPreTarget,
    hasDetailJsonTextareaTarget: true,
    detailJsonTextareaTarget,
    hasRatingAnnouncementTarget: true,
    ratingAnnouncementTarget,
    hasBulkRatingBarTarget: true,
    bulkRatingBarTarget,
    _fetchRequestId: 0,
    _popovers: new Map(),
    _pageSize: 10,
    _currentStart: 0,
    _lastNumFound: 0,
    _diffSnapshotIds: [],
    _showOnlyRated: false,
  })
  return controller
}

describe('results_pane_controller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    if (!globalThis.CSS) globalThis.CSS = {}
    if (!globalThis.CSS.escape) globalThis.CSS.escape = (v) => String(v)
    window.bootstrap = {
      Popover: vi.fn().mockImplementation(() => ({
        show: vi.fn(),
        hide: vi.fn(),
        toggle: vi.fn(),
        dispose: vi.fn(),
      })),
      Modal: {
        getOrCreateInstance: vi.fn(() => ({
          show: vi.fn(),
        })),
      },
    }
  })

  describe('_announceRatingChange', () => {
    it('announces rating changes to screen readers', () => {
      const controller = buildController()
      ResultsPaneController.prototype._announceRatingChange.call(controller, 'doc1', '3')

      expect(controller.ratingAnnouncementTarget.textContent).toBe('Set rating 3 for document doc1.')
    })

    it('announces cleared ratings', () => {
      const controller = buildController()
      ResultsPaneController.prototype._announceRatingChange.call(controller, 'doc1', '')

      expect(controller.ratingAnnouncementTarget.textContent).toBe('Cleared rating for document doc1.')
    })
  })

  describe('_openDetailModal', () => {
    it('opens detail modal with fields from data-doc-fields', async () => {
      const controller = buildController()
      const card = document.createElement('div')
      card.className = 'document-card'
      card.dataset.docId = 'doc1'
      card.dataset.docFields = JSON.stringify({ title: 'Test Doc', body: 'Content' })

      const triggerEl = document.createElement('button')
      triggerEl.setAttribute('data-results-pane-details', '')
      card.appendChild(triggerEl)

      await ResultsPaneController.prototype._openDetailModal.call(controller, triggerEl)

      expect(controller.detailModalTitleTarget.textContent).toBe('Document: Test Doc')
      expect(controller.detailFieldsListTarget.querySelector('dl')).toBeTruthy()
      expect(controller.detailFieldsListTarget.querySelector('dt').textContent).toBe('title')
      expect(controller.detailFieldsListTarget.querySelector('dd').textContent).toBe('Test Doc')
    })

    it('handles empty fields gracefully', async () => {
      const controller = buildController()
      const card = document.createElement('div')
      card.className = 'document-card'
      card.dataset.docId = 'doc1'
      card.dataset.docFields = JSON.stringify({})

      const triggerEl = document.createElement('button')
      triggerEl.setAttribute('data-results-pane-details', '')
      card.appendChild(triggerEl)

      await ResultsPaneController.prototype._openDetailModal.call(controller, triggerEl)

      expect(controller.detailFieldsListTarget.querySelector('p.text-muted').textContent).toBe('No fields available.')
    })

    it('renders object fields as JSON', async () => {
      const controller = buildController()
      const card = document.createElement('div')
      card.className = 'document-card'
      card.dataset.docId = 'doc1'
      card.dataset.docFields = JSON.stringify({ metadata: { tags: ['tag1', 'tag2'] } })

      const triggerEl = document.createElement('button')
      triggerEl.setAttribute('data-results-pane-details', '')
      card.appendChild(triggerEl)

      await ResultsPaneController.prototype._openDetailModal.call(controller, triggerEl)

      const pre = controller.detailFieldsListTarget.querySelector('pre')
      expect(pre).toBeTruthy()
      expect(pre.textContent).toContain('tag1')
    })
  })

  describe('_applyRating', () => {
    it('sends PUT request to update rating', async () => {
      const controller = buildController()
      apiFetch.mockResolvedValue({
        ok: true,
        headers: { get: vi.fn(() => 'application/json') },
        json: async () => ({ rating: 3 }),
      })

      await ResultsPaneController.prototype._applyRating.call(controller, 'doc1', 3)

      expect(apiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/ratings'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ rating: { doc_id: 'doc1', rating: 3 } }),
        })
      )
      expect(triggerScoreRefresh).toHaveBeenCalled()
    })

    it('sends DELETE request to clear rating', async () => {
      const controller = buildController()
      apiFetch.mockResolvedValue({
        ok: true,
        headers: { get: vi.fn(() => 'application/json') },
      })

      await ResultsPaneController.prototype._applyRating.call(controller, 'doc1', NaN)

      expect(apiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/ratings'),
        expect.objectContaining({
          method: 'DELETE',
        })
      )
    })

    it('announces rating change after successful update', async () => {
      const controller = buildController()
      apiFetch.mockResolvedValue({
        ok: true,
        headers: { get: vi.fn(() => 'application/json') },
        json: async () => ({ rating: 2 }),
      })

      await ResultsPaneController.prototype._applyRating.call(controller, 'doc1', 2)

      expect(controller.ratingAnnouncementTarget.textContent).toBe('Set rating 2 for document doc1.')
    })
  })

  describe('fetchResults', () => {
    it('fetches results and renders HTML', async () => {
      const controller = buildController()
      const mockHtml = `
        <div data-results-pane-html-response data-num-found="5">
          <p class="text-muted small mb-2">Found 5 results</p>
          <div class="document-card" data-doc-id="doc1"></div>
          <div class="document-card" data-doc-id="doc2"></div>
        </div>
      `
      apiFetch.mockResolvedValue({
        ok: true,
        text: async () => mockHtml,
      })

      await ResultsPaneController.prototype.fetchResults.call(controller)

      expect(apiFetch).toHaveBeenCalled()
      expect(controller.resultsContainerTarget.querySelector('.document-card')).toBeTruthy()
    })

    it('appends diff snapshot IDs to URL when present', async () => {
      const controller = buildController()
      controller._diffSnapshotIds = [1, 2]
      apiFetch.mockResolvedValue({
        ok: true,
        text: async () => '<div data-results-pane-html-response data-num-found="0"></div>',
      })

      await ResultsPaneController.prototype.fetchResults.call(controller)

      expect(apiFetch).toHaveBeenCalledWith(
        expect.stringContaining('diff_snapshot_ids'),
        expect.any(Object)
      )
    })

    it('shows error message on fetch failure', async () => {
      const controller = buildController()
      apiFetch.mockRejectedValue(new Error('Network error'))

      await ResultsPaneController.prototype.fetchResults.call(controller)

      expect(controller.errorMessageTarget.classList.contains('d-none')).toBe(false)
    })
  })

  describe('_updateDocCardRating', () => {
    it('updates rating badge in document card', () => {
      const controller = buildController()
      const card = document.createElement('div')
      card.dataset.docId = 'doc1'
      const badge = document.createElement('div')
      badge.className = 'rating-badge'
      card.appendChild(badge)
      controller.resultsContainerTarget.appendChild(card)

      ResultsPaneController.prototype._updateDocCardRating.call(controller, 'doc1', '3')

      const ratingEl = badge.querySelector('[data-rating-trigger]')
      expect(ratingEl).toBeTruthy()
      expect(ratingEl.textContent).toBe('3')
      expect(ratingEl.className).toBe('badge bg-primary')
    })

    it('clears rating badge when rating is empty', () => {
      const controller = buildController()
      const card = document.createElement('div')
      card.dataset.docId = 'doc1'
      const badge = document.createElement('div')
      badge.className = 'rating-badge'
      card.appendChild(badge)
      controller.resultsContainerTarget.appendChild(card)

      ResultsPaneController.prototype._updateDocCardRating.call(controller, 'doc1', '')

      const ratingEl = badge.querySelector('[data-rating-trigger]')
      expect(ratingEl.textContent).toBe('Rate')
      expect(ratingEl.className).toBe('badge bg-secondary')
    })
  })
})
