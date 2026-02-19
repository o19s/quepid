import { describe, expect, it, vi } from 'vitest'

vi.mock('@hotwired/stimulus', () => ({
  Controller: class {},
}))

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
})
