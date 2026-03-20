import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Application } from '@hotwired/stimulus'
import QueryRowController from '../../../app/javascript/controllers/query_row_controller'

describe('QueryRowController', () => {
  let application

  beforeEach(async () => {
    document.head.innerHTML = '<meta name="csrf-token" content="test-token">'
    document.body.innerHTML = `
      <li data-controller="query-row"
          data-query-row-query-id-value="42">
        <div class="result-header">
          <span class="toggleSign glyphicon glyphicon-chevron-down"
                data-action="click->query-row#toggle"
                data-query-row-target="chevron"></span>
        </div>
        <div class="sub-results" style="display:none"
             data-query-row-target="expandedContent">
          <button data-action="click->query-row#deleteQuery">Delete</button>
        </div>
      </li>
    `

    document.body.dataset.quepidRootUrl = ''
    document.body.dataset.caseId = '1'

    application = Application.start()
    application.register('query-row', QueryRowController)
    await new Promise(r => setTimeout(r, 50))
  })

  afterEach(() => {
    application.stop()
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
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true })
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true)

    const deleteBtn = document.querySelector('[data-action="click->query-row#deleteQuery"]')
    const li = document.querySelector('[data-controller="query-row"]')

    deleteBtn.dispatchEvent(new Event('click', { bubbles: true }))
    await new Promise(r => setTimeout(r, 50))

    expect(fetchSpy).toHaveBeenCalledWith('/api/cases/1/queries/42', expect.objectContaining({
      method: 'DELETE',
    }))

    expect(document.querySelector('[data-controller="query-row"]')).toBeNull()

    fetchSpy.mockRestore()
  })
})
