// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@hotwired/stimulus', () => ({
  Controller: class {},
}))

vi.mock('api/fetch', () => ({
  apiFetch: vi.fn(),
}))

vi.mock('utils/quepid_root', () => ({
  getQuepidRootUrl: vi.fn(() => ''),
  buildApiUrl: vi.fn((...parts) => `/api/${parts.join('/')}`),
  buildPageUrl: vi.fn((...parts) => `/page/${parts.join('/')}`),
}))

import { apiFetch } from 'api/fetch'
import SettingsPanelController from 'controllers/settings_panel_controller'

function buildController() {
  const panelTarget = document.createElement('div')
  const paramsFormTarget = document.createElement('form')
  const queryParamsTarget = document.createElement('textarea')
  queryParamsTarget.value = 'q=##query##&locale=##locale##&platform=##platform##'
  const escapeQueryTarget = document.createElement('input')
  escapeQueryTarget.type = 'checkbox'
  const numberOfRowsTarget = document.createElement('input')
  numberOfRowsTarget.type = 'number'
  numberOfRowsTarget.value = '10'
  const curatorVarsContainerTarget = document.createElement('div')
  const urlValidationFeedbackTarget = document.createElement('div')
  const queryParamsFeedbackTarget = document.createElement('div')
  const endpointSelectTarget = document.createElement('select')
  const tryHistoryToggleTarget = document.createElement('button')

  const controller = Object.create(SettingsPanelController.prototype)
  Object.assign(controller, {
    caseIdValue: 1,
    tryNumberValue: 1,
    curatorVarsValue: { locale: 'en-US', platform: 'web' },
    searchEngineValue: 'solr',
    triesCountValue: 3,
    hasPanelTarget: true,
    panelTarget,
    hasParamsFormTarget: true,
    paramsFormTarget,
    hasQueryParamsTarget: true,
    queryParamsTarget,
    hasEscapeQueryTarget: true,
    escapeQueryTarget,
    hasNumberOfRowsTarget: true,
    numberOfRowsTarget,
    hasCuratorVarsContainerTarget: true,
    curatorVarsContainerTarget,
    hasUrlValidationFeedbackTarget: true,
    urlValidationFeedbackTarget,
    hasQueryParamsFeedbackTarget: true,
    queryParamsFeedbackTarget,
    hasEndpointSelectTarget: true,
    endpointSelectTarget,
    hasTryHistoryToggleTarget: true,
    tryHistoryToggleTarget,
    element: document.createElement('div'),
    _tryHistoryExpanded: false,
  })
  return controller
}

describe('settings_panel_controller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.bootstrap = {
      Collapse: vi.fn().mockImplementation(() => ({
        toggle: vi.fn(),
        getInstance: vi.fn(),
      })),
    }
    window.flash = {}
    window.confirm = vi.fn(() => true)
  })

  describe('_extractCuratorVars', () => {
    it('extracts curator variable names from query params', () => {
      const controller = buildController()
      controller.queryParamsTarget.value = 'q=##query##&locale=##locale##&platform=##platform##'

      const vars = SettingsPanelController.prototype._extractCuratorVars.call(controller)

      expect(vars).toEqual(['query', 'locale', 'platform'])
    })

    it('deduplicates variable names', () => {
      const controller = buildController()
      controller.queryParamsTarget.value = 'q=##query##&q2=##query##&locale=##locale##'

      const vars = SettingsPanelController.prototype._extractCuratorVars.call(controller)

      expect(vars).toEqual(['query', 'locale'])
    })

    it('returns empty array when no variables found', () => {
      const controller = buildController()
      controller.queryParamsTarget.value = 'q=test&rows=10'

      const vars = SettingsPanelController.prototype._extractCuratorVars.call(controller)

      expect(vars).toEqual([])
    })
  })

  describe('_renderCuratorVarInputs', () => {
    it('renders input fields for each curator variable', () => {
      const controller = buildController()
      controller.queryParamsTarget.value = 'q=##query##&locale=##locale##'

      SettingsPanelController.prototype._renderCuratorVarInputs.call(controller)

      const inputs = controller.curatorVarsContainerTarget.querySelectorAll('input[data-curator-var-name]')
      expect(inputs.length).toBe(2)
      expect(inputs[0].dataset.curatorVarName).toBe('query')
      expect(inputs[1].dataset.curatorVarName).toBe('locale')
    })

    it('populates inputs with saved values', () => {
      const controller = buildController()
      controller.curatorVarsValue = { locale: 'en-US', platform: 'web' }
      controller.queryParamsTarget.value = 'q=##query##&locale=##locale##&platform=##platform##'

      SettingsPanelController.prototype._renderCuratorVarInputs.call(controller)

      const localeInput = controller.curatorVarsContainerTarget.querySelector('[data-curator-var-name="locale"]')
      const platformInput = controller.curatorVarsContainerTarget.querySelector('[data-curator-var-name="platform"]')
      expect(localeInput.value).toBe('en-US')
      expect(platformInput.value).toBe('web')
    })

    it('adds aria-label and aria-describedby attributes', () => {
      const controller = buildController()
      controller.queryParamsTarget.value = 'q=##query##'

      SettingsPanelController.prototype._renderCuratorVarInputs.call(controller)

      const input = controller.curatorVarsContainerTarget.querySelector('[data-curator-var-name="query"]')
      expect(input.getAttribute('aria-label')).toBe('Value for curator variable query')
      expect(input.getAttribute('aria-describedby')).toBeTruthy()
    })

    it('clears container when no variables found', () => {
      const controller = buildController()
      controller.queryParamsTarget.value = 'q=test'
      controller.curatorVarsContainerTarget.innerHTML = '<div>existing content</div>'

      SettingsPanelController.prototype._renderCuratorVarInputs.call(controller)

      expect(controller.curatorVarsContainerTarget.children.length).toBe(0)
    })

    it('renders heading for curator variables section', () => {
      const controller = buildController()
      controller.queryParamsTarget.value = 'q=##query##'

      SettingsPanelController.prototype._renderCuratorVarInputs.call(controller)

      const heading = controller.curatorVarsContainerTarget.querySelector('h6')
      expect(heading).toBeTruthy()
      expect(heading.textContent).toBe('Curator variables')
    })
  })

  describe('_collectCuratorVars', () => {
    it('collects values from rendered inputs', () => {
      const controller = buildController()
      controller.queryParamsTarget.value = 'q=##query##&locale=##locale##'
      SettingsPanelController.prototype._renderCuratorVarInputs.call(controller)

      // Set values
      const queryInput = controller.curatorVarsContainerTarget.querySelector('[data-curator-var-name="query"]')
      const localeInput = controller.curatorVarsContainerTarget.querySelector('[data-curator-var-name="locale"]')
      queryInput.value = 'test query'
      localeInput.value = 'en-US'

      const vars = SettingsPanelController.prototype._collectCuratorVars.call(controller)

      expect(vars).toEqual({ query: 'test query', locale: 'en-US' })
    })

    it('returns empty object when no inputs exist', () => {
      const controller = buildController()
      controller.queryParamsTarget.value = 'q=test'

      const vars = SettingsPanelController.prototype._collectCuratorVars.call(controller)

      expect(vars).toEqual({})
    })
  })

  describe('saveParams', () => {
    it('sends PUT request with query params and curator vars', async () => {
      const controller = buildController()
      controller.queryParamsTarget.value = 'q=##query##&locale=##locale##'
      SettingsPanelController.prototype._renderCuratorVarInputs.call(controller)
      const queryInput = controller.curatorVarsContainerTarget.querySelector('[data-curator-var-name="query"]')
      const localeInput = controller.curatorVarsContainerTarget.querySelector('[data-curator-var-name="locale"]')
      queryInput.value = 'test'
      localeInput.value = 'en-US'

      apiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      })

      const event = { preventDefault: vi.fn() }
      await SettingsPanelController.prototype.saveParams.call(controller, event)

      expect(event.preventDefault).toHaveBeenCalled()
      expect(apiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/tries/1'),
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('curator_vars'),
        })
      )
    })

    it('includes escape_query and number_of_rows in request', async () => {
      const controller = buildController()
      controller.escapeQueryTarget.checked = true
      controller.numberOfRowsTarget.value = '20'

      apiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      })

      const event = { preventDefault: vi.fn() }
      await SettingsPanelController.prototype.saveParams.call(controller, event)

      const callBody = JSON.parse(apiFetch.mock.calls[0][1].body)
      expect(callBody.try.escape_query).toBe(true)
      expect(callBody.try.number_of_rows).toBe(20)
    })

    it('omits curator_vars when none are present', async () => {
      const controller = buildController()
      controller.queryParamsTarget.value = 'q=test'

      apiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      })

      const event = { preventDefault: vi.fn() }
      await SettingsPanelController.prototype.saveParams.call(controller, event)

      const callBody = JSON.parse(apiFetch.mock.calls[0][1].body)
      expect(callBody.curator_vars).toBeUndefined()
    })
  })

  describe('extractVars', () => {
    it('re-renders curator var inputs', () => {
      const controller = buildController()
      controller.queryParamsTarget.value = 'q=##query##'
      const renderSpy = vi.spyOn(SettingsPanelController.prototype, '_renderCuratorVarInputs')

      SettingsPanelController.prototype.extractVars.call(controller)

      expect(renderSpy).toHaveBeenCalled()
    })
  })

  describe('validateQueryParams', () => {
    it('validates JSON for Elasticsearch engines', () => {
      const controller = buildController()
      controller.searchEngineValue = 'es'
      controller.queryParamsTarget.value = '{"query": {"match": "test"}}'

      SettingsPanelController.prototype.validateQueryParams.call(controller)

      expect(controller.queryParamsFeedbackTarget.classList.contains('d-none')).toBe(false)
      expect(controller.queryParamsFeedbackTarget.innerHTML).toContain('check-circle')
    })

    it('shows error for invalid JSON', () => {
      const controller = buildController()
      controller.searchEngineValue = 'es'
      controller.queryParamsTarget.value = '{"query": invalid}'

      SettingsPanelController.prototype.validateQueryParams.call(controller)

      expect(controller.queryParamsFeedbackTarget.innerHTML).toContain('exclamation-triangle')
    })

    it('checks for Solr parameter typos', () => {
      const controller = buildController()
      controller.searchEngineValue = 'solr'
      controller.queryParamsTarget.value = 'q=test&deftype=edismax' // lowercase 'deftype' is wrong

      SettingsPanelController.prototype.validateQueryParams.call(controller)

      expect(controller.queryParamsFeedbackTarget.innerHTML).toContain('Did you mean')
      expect(controller.queryParamsFeedbackTarget.innerHTML).toContain('defType')
    })
  })

  describe('toggleTryHistory', () => {
    it('toggles visibility of extra try history items', () => {
      const controller = buildController()
      const extra1 = document.createElement('div')
      extra1.className = 'js-try-history-extra'
      extra1.classList.add('d-none')
      const extra2 = document.createElement('div')
      extra2.className = 'js-try-history-extra'
      extra2.classList.add('d-none')
      controller.element.appendChild(extra1)
      controller.element.appendChild(extra2)

      SettingsPanelController.prototype.toggleTryHistory.call(controller)

      expect(extra1.classList.contains('d-none')).toBe(false)
      expect(extra2.classList.contains('d-none')).toBe(false)
    })

    it('updates toggle button text', () => {
      const controller = buildController()
      const extra = document.createElement('div')
      extra.className = 'js-try-history-extra'
      extra.classList.add('d-none')
      controller.element.appendChild(extra)

      SettingsPanelController.prototype.toggleTryHistory.call(controller)

      expect(controller.tryHistoryToggleTarget.textContent).toBe('Show fewer tries')
    })
  })
})
