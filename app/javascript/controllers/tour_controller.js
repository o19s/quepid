import { Controller } from '@hotwired/stimulus';
import TOUR_STEPS from 'modules/tour_steps';
import { buildCurrentPageUrlWithParams, getCurrentPageSearchParams } from 'utils/quepid_root';

// Guided tour for the workspace using Bootstrap popovers.
// 9-step tour covering the full workspace layout, matching the Angular/Shepherd.js
// tour structure. Features: highlight overlay, back/next navigation, step counter,
// close (X) button, Escape key, and click-outside-to-close on the dimmed overlay.
// Triggered via ?startTour=true URL param (set by wizard) or manually.
// Popover uses container: this.element so Stimulus actions (Skip/Back/Next) work.
export default class extends Controller {
  static values = { autoStart: Boolean };

  connect() {
    this._currentStep = -1;
    this._popovers = [];
    this._overlay = null;
    this._escapeHandler = null;

    // Check for startTour URL param (set by wizard after completion + reload)
    if (getCurrentPageSearchParams().has('startTour')) {
      window.history.replaceState({}, '', buildCurrentPageUrlWithParams({ startTour: null }));
      // Delay to ensure workspace is fully rendered after reload
      setTimeout(() => this.start(), 1000);
    } else if (this.autoStartValue) {
      setTimeout(() => this.start(), 1000);
    }
  }

  disconnect() {
    this._cleanup();
  }

  start() {
    this._cleanup();
    this._createOverlay();
    this._currentStep = 0;
    this._showStep();
  }

  next() {
    this._hideCurrentStep();
    this._currentStep++;
    if (this._currentStep < TOUR_STEPS.length) {
      this._showStep();
    } else {
      this._finish();
    }
  }

  back() {
    if (this._currentStep <= 0) return;
    this._hideCurrentStep();
    this._currentStep--;
    this._showStep();
  }

  skip() {
    this._cleanup();
  }

  _showStep() {
    const step = TOUR_STEPS[this._currentStep];
    if (!step) return;

    const target = document.querySelector(step.target);
    if (!target) {
      // Skip missing targets
      this.next();
      return;
    }

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    this._highlightTarget(target);

    const Popover = window.bootstrap?.Popover;
    if (!Popover) return;

    const isFirst = this._currentStep === 0;
    const isLast = this._currentStep === TOUR_STEPS.length - 1;
    const stepLabel = `${this._currentStep + 1}/${TOUR_STEPS.length}`;

    let buttons;
    if (isFirst) {
      buttons = `
        <button type="button" class="btn btn-outline-secondary" data-action="click->tour#skip">Skip</button>
        <button type="button" class="btn btn-primary" data-action="click->tour#next">Next</button>
      `;
    } else if (isLast) {
      buttons = `
        <button type="button" class="btn btn-outline-secondary" data-action="click->tour#back">Back</button>
        <button type="button" class="btn btn-primary" data-action="click->tour#skip">Finish</button>
      `;
    } else {
      buttons = `
        <button type="button" class="btn btn-outline-secondary" data-action="click->tour#back">Back</button>
        <button type="button" class="btn btn-primary" data-action="click->tour#next">Next</button>
      `;
    }

    const content = `
      <p class="mb-2">${step.content}</p>
      <div class="d-flex justify-content-between align-items-center">
        <small class="text-muted">${stepLabel}</small>
        <div class="btn-group btn-group-sm">
          ${buttons}
        </div>
      </div>
    `;

    const titleHtml = `
      <span class="d-flex justify-content-between align-items-center w-100">
        <span>${step.title}</span>
        <button type="button" class="btn-close btn-sm" data-action="click->tour#skip" aria-label="Close tour"></button>
      </span>
    `;

    const popover = new Popover(target, {
      title: titleHtml,
      content: content,
      html: true,
      trigger: 'manual',
      placement: step.placement || 'bottom',
      container: this.element,
    });
    popover.show();
    this._popovers.push(popover);
  }

  _hideCurrentStep() {
    const popover = this._popovers[this._currentStep];
    if (popover) popover.dispose();
    this._clearHighlight();
  }

  _finish() {
    this._cleanup();
  }

  _createOverlay() {
    if (this._overlay) return;
    this._overlay = document.createElement('div');
    this._overlay.className = 'tour-overlay';
    this._overlay.addEventListener('click', () => this.skip());
    document.body.appendChild(this._overlay);

    this._escapeHandler = (e) => {
      if (e.key === 'Escape') this.skip();
    };
    document.addEventListener('keydown', this._escapeHandler);
  }

  _highlightTarget(target) {
    this._clearHighlight();
    target.classList.add('tour-highlight');
  }

  _clearHighlight() {
    const highlighted = document.querySelector('.tour-highlight');
    if (highlighted) highlighted.classList.remove('tour-highlight');
  }

  _cleanup() {
    this._popovers.forEach((p) => {
      try {
        p.dispose();
      } catch (_e) {
        /* noop */
      }
    });
    this._popovers = [];
    this._currentStep = -1;
    this._clearHighlight();
    if (this._escapeHandler) {
      document.removeEventListener('keydown', this._escapeHandler);
      this._escapeHandler = null;
    }
    if (this._overlay) {
      this._overlay.remove();
      this._overlay = null;
    }
  }
}
