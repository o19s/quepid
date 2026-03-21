import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Application } from '@hotwired/stimulus'
import QueryRowController from '../../../app/javascript/controllers/query_row_controller'

// Mock the search_executor module so tests don't make real HTTP calls
vi.mock('../../../app/javascript/modules/search_executor', () => ({
  executeSearch: vi.fn().mockResolvedValue({
    docs: [{ id: '1', title: 'Test Doc', subs: {}, thumb: null, _source: {} }],
    numFound: 1,
    linkUrl: 'http://example.com/search',
    error: null,
  }),
}))

// Mock the api_url module to return predictable URLs
vi.mock('../../../app/javascript/modules/api_url', () => ({
  apiUrl: vi.fn((path) => path),
  csrfToken: vi.fn(() => 'test-token'),
}))

describe('QueryRowController', () => {
  let application

  beforeEach(async () => {
    // Reset the try config cache between tests by reloading the module
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        search_url: 'http://solr:8983/solr/test/select',
        search_engine: 'solr',
        args: { q: ['#$query##'] },
        field_spec: 'title',
        number_of_rows: 10,
        proxy_requests: true,
        options: {},
      }),
    })

    // Remove stale rating color styles from prior tests
    document.getElementById('rating-color-styles')?.remove()

    document.head.innerHTML = '<meta name="csrf-token" content="test-token">'
    document.body.innerHTML = `
      <li data-controller="query-row"
          data-query-row-query-id-value="42"
          data-query-row-query-text-value="star wars"
          data-query-row-ratings-value='{"1": 3}'>
        <div class="result-header">
          <span class="toggleSign glyphicon glyphicon-chevron-down"
                data-action="click->query-row#toggle"
                data-query-row-target="chevron"></span>
          <small data-query-row-target="totalResults">1 rated</small>
        </div>
        <div class="sub-results" style="display:none"
             data-query-row-target="expandedContent">
          <div class="overall-rating" data-query-row-target="scoreDisplay">--</div>
          <button data-action="click->query-row#deleteQuery">Delete</button>
          <div data-query-row-target="resultsContainer">
            <p>Expand to run search.</p>
          </div>
        </div>
      </li>
    `

    document.body.dataset.quepidRootUrl = ''
    document.body.dataset.caseId = '1'
    document.body.dataset.tryNumber = '0'
    document.body.dataset.scorerScale = '[0,1,2,3]'
    document.body.dataset.scorerName = 'AP@10'

    application = Application.start()
    application.register('query-row', QueryRowController)
    await new Promise(r => setTimeout(r, 50))
  })

  afterEach(() => {
    application.stop()
    vi.restoreAllMocks()
  })

  it('starts collapsed', () => {
    const content = document.querySelector('[data-query-row-target="expandedContent"]')
    expect(content.style.display).toBe('none')
  })

  it('expands on toggle click', () => {
    const chevron = document.querySelector('[data-query-row-target="chevron"]')
    const content = document.querySelector('[data-query-row-target="expandedContent"]')

    chevron.dispatchEvent(new Event('click', { bubbles: true }))

    expect(content.style.display).toBe('block')
    expect(chevron.classList.contains('glyphicon-chevron-up')).toBe(true)
  })

  it('collapses on second toggle', () => {
    const chevron = document.querySelector('[data-query-row-target="chevron"]')
    const content = document.querySelector('[data-query-row-target="expandedContent"]')

    chevron.dispatchEvent(new Event('click', { bubbles: true }))
    chevron.dispatchEvent(new Event('click', { bubbles: true }))

    expect(content.style.display).toBe('none')
    expect(chevron.classList.contains('glyphicon-chevron-down')).toBe(true)
  })

  it('deletes query via API and removes element', async () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true)

    const deleteBtn = document.querySelector('[data-action="click->query-row#deleteQuery"]')

    deleteBtn.dispatchEvent(new Event('click', { bubbles: true }))
    await new Promise(r => setTimeout(r, 50))

    expect(globalThis.fetch).toHaveBeenCalledWith('api/cases/1/queries/42', expect.objectContaining({
      method: 'DELETE',
    }))

    expect(document.querySelector('[data-controller="query-row"]')).toBeNull()
  })

  it('renders rating buttons after search', async () => {
    const chevron = document.querySelector('[data-query-row-target="chevron"]')
    chevron.dispatchEvent(new Event('click', { bubbles: true }))

    // Wait for search to execute and results to render
    await new Promise(r => setTimeout(r, 200))

    const ratingBtns = document.querySelectorAll('.rating-btn:not(.rating-btn-clear)')
    // Scale is [0,1,2,3] so 4 rating buttons per doc, 1 doc returned
    expect(ratingBtns.length).toBe(4)

    // Doc '1' has a bootstrapped rating of 3, so the "3" button should be active
    const activeBtn = document.querySelector('.rating-btn-active')
    expect(activeBtn).not.toBeNull()
    expect(activeBtn.textContent).toBe('3')
  })

  it('shows clear button for rated doc', async () => {
    const chevron = document.querySelector('[data-query-row-target="chevron"]')
    chevron.dispatchEvent(new Event('click', { bubbles: true }))
    await new Promise(r => setTimeout(r, 200))

    const clearBtn = document.querySelector('.rating-btn-clear')
    expect(clearBtn).not.toBeNull()
  })

  it('sends PUT when clicking a rating button', async () => {
    const chevron = document.querySelector('[data-query-row-target="chevron"]')
    chevron.dispatchEvent(new Event('click', { bubbles: true }))
    await new Promise(r => setTimeout(r, 200))

    // Clear the fetch mock call history (search calls happened above)
    vi.mocked(globalThis.fetch).mockClear()
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 1, doc_id: '1', rating: 2, query_id: 42 }),
    })

    // Click the "2" button (not the currently active "3")
    const btns = document.querySelectorAll('.rating-btn:not(.rating-btn-clear)')
    const btn2 = Array.from(btns).find(b => b.textContent === '2')
    btn2.click()
    await new Promise(r => setTimeout(r, 100))

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'api/cases/1/queries/42/ratings',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ rating: { doc_id: '1', rating: 2 } }),
      })
    )
  })

  it('injects rating color styles into document head', async () => {
    const chevron = document.querySelector('[data-query-row-target="chevron"]')
    chevron.dispatchEvent(new Event('click', { bubbles: true }))
    await new Promise(r => setTimeout(r, 200))

    const styleEl = document.getElementById('rating-color-styles')
    expect(styleEl).not.toBeNull()
    expect(styleEl.textContent).toContain('rating-color-0')
    expect(styleEl.textContent).toContain('rating-color-3')
  })
})
