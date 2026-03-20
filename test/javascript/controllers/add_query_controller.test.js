import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Application } from '@hotwired/stimulus'
import AddQueryController from '../../../app/javascript/controllers/add_query_controller'

describe('AddQueryController', () => {
  let application

  beforeEach(async () => {
    document.head.innerHTML = '<meta name="csrf-token" content="test-token">'
    document.body.innerHTML = `
      <form data-controller="add-query"
            data-add-query-url-value="/api/cases/1/queries"
            data-action="submit->add-query#submit">
        <input data-add-query-target="input" type="text" />
        <input type="submit" value="Add query" />
      </form>
    `

    application = Application.start()
    application.register('add-query', AddQueryController)
    await new Promise(r => setTimeout(r, 50))
  })

  afterEach(() => {
    application.stop()
  })

  it('does nothing when input is empty', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true })
    const form = document.querySelector('form')

    form.dispatchEvent(new Event('submit', { bubbles: true }))
    await new Promise(r => setTimeout(r, 50))

    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('sends POST with single query text', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true })
    // Replace location.reload since jsdom doesn't support spying on it
    delete window.location
    window.location = { reload: vi.fn() }

    const input = document.querySelector('[data-add-query-target="input"]')
    const form = document.querySelector('form')

    input.value = 'star wars'
    form.dispatchEvent(new Event('submit', { bubbles: true }))
    await new Promise(r => setTimeout(r, 50))

    expect(fetchSpy).toHaveBeenCalledWith('/api/cases/1/queries', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ query: { query_text: 'star wars' } }),
    }))

    fetchSpy.mockRestore()
  })

  it('sends bulk POST for semicolon-separated queries', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true })
    delete window.location
    window.location = { reload: vi.fn() }

    const input = document.querySelector('[data-add-query-target="input"]')
    const form = document.querySelector('form')

    input.value = 'star wars; lord of the rings'
    form.dispatchEvent(new Event('submit', { bubbles: true }))
    await new Promise(r => setTimeout(r, 50))

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/bulk/cases/1/queries'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ queries: ['star wars', 'lord of the rings'] }),
      })
    )

    fetchSpy.mockRestore()
  })

  it('clears input after successful submission', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true })
    delete window.location
    window.location = { reload: vi.fn() }

    const input = document.querySelector('[data-add-query-target="input"]')
    const form = document.querySelector('form')

    input.value = 'test query'
    form.dispatchEvent(new Event('submit', { bubbles: true }))
    await new Promise(r => setTimeout(r, 50))

    expect(input.value).toBe('')

    fetchSpy.mockRestore()
  })
})
