import { describe, expect, it, vi } from 'vitest'

vi.mock('@hotwired/stimulus', () => ({
  Controller: class {},
}))

vi.mock('api/fetch', () => ({
  apiFetch: vi.fn(),
}))

vi.mock('utils/quepid_root', () => ({
  getQuepidRootUrl: () => '',
  buildApiUrl: () => '/api/cases/1/tries/1',
  buildCaseQueriesUrl: () => '/case/1/queries',
}))

import { apiFetch } from 'api/fetch'
import NewCaseWizardController from 'controllers/new_case_wizard_controller'

function makeStep(stepNum) {
  return {
    dataset: { wizardStep: String(stepNum) },
    classList: {
      classes: new Set(stepNum === 1 ? [] : ['d-none']),
      toggle(name, shouldHide) {
        if (shouldHide) this.classes.add(name)
        else this.classes.delete(name)
      },
    },
    attrs: {},
    setAttribute(name, value) {
      this.attrs[name] = value
    },
    getAttribute(name) {
      return this.attrs[name]
    },
  }
}

describe('new_case_wizard_controller', () => {
  it('announces the current step via aria-live target', () => {
    const modalTitleTarget = { textContent: '' }
    const stepAnnouncerTarget = { textContent: '' }
    const backBtnTarget = { classList: { toggle() {} } }
    const nextBtnTarget = { classList: { toggle() {} } }
    const finishBtnTarget = { classList: { toggle() {} } }

    const controller = {
      _currentStep: 2,
      stepTargets: [makeStep(1), makeStep(2), makeStep(3), makeStep(4)],
      hasBackBtnTarget: true,
      backBtnTarget,
      hasNextBtnTarget: true,
      nextBtnTarget,
      hasFinishBtnTarget: true,
      finishBtnTarget,
      hasModalTitleTarget: true,
      modalTitleTarget,
      hasStepAnnouncerTarget: true,
      stepAnnouncerTarget,
      _updateNavState: vi.fn(),
    }

    NewCaseWizardController.prototype._showStep.call(controller)

    expect(modalTitleTarget.textContent).toBe('Step 2: Search Endpoint')
    expect(stepAnnouncerTarget.textContent).toContain('Wizard step 2 of 4')
    expect(controller.stepTargets[0].getAttribute('aria-hidden')).toBe('true')
    expect(controller.stepTargets[1].getAttribute('aria-hidden')).toBe('false')
  })

  it('defaults api method by engine', () => {
    expect(NewCaseWizardController.prototype._defaultApiMethodForEngine.call({}, 'solr')).toBe('GET')
    expect(NewCaseWizardController.prototype._defaultApiMethodForEngine.call({}, 'searchapi')).toBe('GET')
    expect(NewCaseWizardController.prototype._defaultApiMethodForEngine.call({}, 'es')).toBe('POST')
    expect(NewCaseWizardController.prototype._defaultApiMethodForEngine.call({}, 'os')).toBe('POST')
  })

  it('sends POST api_method for es endpoints in save payload', async () => {
    vi.clearAllMocks()
    apiFetch.mockResolvedValue({ ok: true, json: async () => ({}) })
    const controller = {
      caseIdValue: 1,
      tryNumberValue: 1,
      hasFieldSpecTarget: true,
      fieldSpecTarget: { value: 'id:_id,title:title' },
      _tmdbActive: true,
      _tmdbQueryParams: '{"query":{"match_all":{}}}',
      hasExistingEndpointTarget: true,
      existingEndpointTarget: { value: '' },
      hasSearchEngineTarget: true,
      searchEngineTarget: { value: 'es' },
      hasEndpointUrlTarget: true,
      endpointUrlTarget: { value: 'http://example.test/es/_search' },
      _defaultApiMethodForEngine: NewCaseWizardController.prototype._defaultApiMethodForEngine,
    }

    await NewCaseWizardController.prototype._saveEndpointAndFieldSpec.call(controller, '')

    expect(apiFetch).toHaveBeenCalledTimes(1)
    const body = JSON.parse(apiFetch.mock.calls[0][1].body)
    expect(body.search_endpoint.api_method).toBe('POST')
    expect(body.search_endpoint.search_engine).toBe('es')
  })
})
