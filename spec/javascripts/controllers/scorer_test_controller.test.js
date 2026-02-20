import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@hotwired/stimulus', () => ({
  Controller: class {},
}));

vi.mock('api/fetch', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from 'api/fetch';
import ScorerTestController from 'controllers/scorer_test_controller';

function buildController({ code = 'setScore(1);' } = {}) {
  const testResultTarget = { textContent: '', className: '' };
  const testBtnTarget = { disabled: false };
  const testBtnLabelTarget = { textContent: '' };
  const testSpinnerTarget = {
    classList: {
      classes: new Set(['d-none']),
      toggle(name, hide) {
        if (hide) this.classes.add(name);
        else this.classes.delete(name);
      },
    },
  };

  return {
    urlValue: '/scorers/123/test',
    hasCodeInputTarget: true,
    codeInputTarget: { value: code },
    hasTestBtnTarget: true,
    testBtnTarget,
    hasTestBtnLabelTarget: true,
    testBtnLabelTarget,
    hasTestSpinnerTarget: true,
    testSpinnerTarget,
    hasTestResultTarget: true,
    testResultTarget,
    _setLoading: ScorerTestController.prototype._setLoading,
    _showResult: ScorerTestController.prototype._showResult,
  };
}

describe('scorer_test_controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses apiFetch and displays the score', async () => {
    const controller = buildController();
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ score: 3.5 }),
    });

    await ScorerTestController.prototype.run.call(controller);

    expect(apiFetch).toHaveBeenCalledWith(
      '/scorers/123/test',
      expect.objectContaining({ method: 'POST' })
    );
    expect(controller.testResultTarget.textContent).toBe('Score: 3.5000');
    expect(controller.testBtnTarget.disabled).toBe(false);
  });

  it('does not submit when code is blank', async () => {
    const controller = buildController({ code: '   ' });

    await ScorerTestController.prototype.run.call(controller);

    expect(apiFetch).not.toHaveBeenCalled();
    expect(controller.testResultTarget.textContent).toBe('Enter scorer code first.');
  });
});
