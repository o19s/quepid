import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Application } from '@hotwired/stimulus'
import InlineEditController from '../../../app/javascript/controllers/inline_edit_controller'

describe('InlineEditController', () => {
  let application

  beforeEach(async () => {
    document.head.innerHTML = '<meta name="csrf-token" content="test-token">'
    document.body.innerHTML = `
      <span data-controller="inline-edit"
            data-inline-edit-url-value="/api/cases/1"
            data-inline-edit-field-value="case_name"
            data-inline-edit-wrap-value="case">
        <span data-inline-edit-target="display"
              data-action="dblclick->inline-edit#startEdit">
          Test Case
        </span>
        <span data-inline-edit-target="form" style="display:none">
          <form data-action="submit->inline-edit#save">
            <input data-inline-edit-target="input" value="Test Case" />
            <button type="button" data-action="click->inline-edit#cancel">Cancel</button>
          </form>
        </span>
      </span>
    `

    application = Application.start()
    application.register('inline-edit', InlineEditController)
    await new Promise(r => setTimeout(r, 50))
  })

  afterEach(() => {
    application.stop()
  })

  it('shows edit form on double-click', () => {
    const display = document.querySelector('[data-inline-edit-target="display"]')
    const form = document.querySelector('[data-inline-edit-target="form"]')

    display.dispatchEvent(new Event('dblclick', { bubbles: true }))

    expect(display.style.display).toBe('none')
    expect(form.style.display).toBe('inline')
  })

  it('populates input with current display text', () => {
    const display = document.querySelector('[data-inline-edit-target="display"]')
    const input = document.querySelector('[data-inline-edit-target="input"]')

    display.dispatchEvent(new Event('dblclick', { bubbles: true }))

    expect(input.value).toBe('Test Case')
  })

  it('hides edit form on cancel', () => {
    const display = document.querySelector('[data-inline-edit-target="display"]')
    const form = document.querySelector('[data-inline-edit-target="form"]')
    const cancel = document.querySelector('[data-action="click->inline-edit#cancel"]')

    // Open edit mode
    display.dispatchEvent(new Event('dblclick', { bubbles: true }))
    // Cancel
    cancel.dispatchEvent(new Event('click', { bubbles: true }))

    expect(form.style.display).toBe('none')
    expect(display.style.display).toBe('inline')
  })

  it('sends PUT request with wrapped field on save', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true })

    const display = document.querySelector('[data-inline-edit-target="display"]')
    const input = document.querySelector('[data-inline-edit-target="input"]')
    const form = document.querySelector('form')

    display.dispatchEvent(new Event('dblclick', { bubbles: true }))
    input.value = 'Renamed Case'
    form.dispatchEvent(new Event('submit', { bubbles: true }))

    await new Promise(r => setTimeout(r, 50))

    expect(fetchSpy).toHaveBeenCalledWith('/api/cases/1', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ case: { case_name: 'Renamed Case' } }),
    }))

    expect(display.textContent).toBe('Renamed Case')
    fetchSpy.mockRestore()
  })
})
