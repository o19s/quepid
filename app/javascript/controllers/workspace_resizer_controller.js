import { Controller } from '@hotwired/stimulus';

// Draggable divider between west (query list) and east (results) panels.
// Persists width to localStorage per case. Hidden when either panel is collapsed.
//
// Usage (on the resizer div between west and east panels):
//   data-controller="workspace-resizer"
//   data-workspace-resizer-case-id-value="123"
const MIN_PCT = 15;
const MAX_PCT = 60;

export default class extends Controller {
  static values = { caseId: Number };

  connect() {
    this._storageKey = `quepid-workspace-resizer-${this.caseIdValue || 0}`;
    this._dragging = false;
    this._boundMouseMove = this._onMouseMove.bind(this);
    this._boundMouseUp = this._onMouseUp.bind(this);
    this._boundTouchMove = this._onTouchMove.bind(this);
    this._boundTouchEnd = this._onTouchEnd.bind(this);

    this._restoreWidth();
    this._observeCollapse();
  }

  disconnect() {
    this._stopDrag();
    this._observer?.disconnect();
  }

  // Actions ------------------------------------------------------------------

  startDrag(event) {
    event.preventDefault();
    this._dragging = true;
    document.addEventListener('mousemove', this._boundMouseMove);
    document.addEventListener('mouseup', this._boundMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  startTouchDrag(event) {
    if (event.touches.length !== 1) return;
    this._dragging = true;
    document.addEventListener('touchmove', this._boundTouchMove, { passive: false });
    document.addEventListener('touchend', this._boundTouchEnd);
  }

  // Private ------------------------------------------------------------------

  _onMouseMove(event) {
    if (!this._dragging) return;
    this._resizeTo(event.clientX);
  }

  _onMouseUp() {
    this._stopDrag();
  }

  _onTouchMove(event) {
    if (!this._dragging) return;
    event.preventDefault();
    this._resizeTo(event.touches[0].clientX);
  }

  _onTouchEnd() {
    this._stopDrag();
  }

  _resizeTo(clientX) {
    const container = this.element.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    const clamped = Math.min(MAX_PCT, Math.max(MIN_PCT, pct));

    const west = this._westPanel();
    if (west) {
      west.style.flexBasis = `${clamped}%`;
      west.style.flex = `0 0 ${clamped}%`;
    }

    this._persistWidth(clamped);
  }

  _stopDrag() {
    if (!this._dragging) return;
    this._dragging = false;
    document.removeEventListener('mousemove', this._boundMouseMove);
    document.removeEventListener('mouseup', this._boundMouseUp);
    document.removeEventListener('touchmove', this._boundTouchMove);
    document.removeEventListener('touchend', this._boundTouchEnd);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }

  _restoreWidth() {
    try {
      const saved = localStorage.getItem(this._storageKey);
      if (saved) {
        const pct = parseFloat(saved);
        if (pct >= MIN_PCT && pct <= MAX_PCT) {
          const west = this._westPanel();
          if (west) {
            west.style.flexBasis = `${pct}%`;
            west.style.flex = `0 0 ${pct}%`;
          }
        }
      }
    } catch (_e) {
      /* ignore */
    }
  }

  _persistWidth(pct) {
    try {
      localStorage.setItem(this._storageKey, String(pct));
    } catch (_e) {
      /* ignore */
    }
  }

  _westPanel() {
    return this.element.parentElement?.querySelector('.workspace-panel.west');
  }

  // Hide resizer when either panel is collapsed
  _observeCollapse() {
    const container = this.element.parentElement;
    if (!container) return;

    this._observer = new MutationObserver(() => this._updateVisibility());
    this._observer.observe(container, {
      attributes: true,
      attributeFilter: ['class'],
      subtree: true,
    });
    this._updateVisibility();
  }

  _updateVisibility() {
    const container = this.element.parentElement;
    if (!container) return;
    const collapsed = container.querySelector('.workspace-panel--collapsed');
    this.element.classList.toggle('d-none', !!collapsed);

    // When a panel is collapsed, clear custom flex-basis so the collapse CSS takes over
    if (collapsed) {
      const west = this._westPanel();
      if (west) {
        west.style.flexBasis = '';
        west.style.flex = '';
      }
    } else {
      this._restoreWidth();
    }
  }
}
