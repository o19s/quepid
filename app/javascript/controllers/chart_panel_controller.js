import { Controller } from '@hotwired/stimulus';

// Toggles the chart panel (score-over-time Qgraph). Wires QgraphComponent into the workspace.
export default class extends Controller {
  static targets = ['trigger', 'panel'];

  toggle() {
    if (!this.hasPanelTarget) return;
    const el = this.panelTarget;
    const Collapse = window.bootstrap?.Collapse;
    if (Collapse) {
      const instance = Collapse.getInstance(el) ?? new Collapse(el, { toggle: true });
      instance.toggle();
    } else {
      el.classList.toggle('show');
    }
  }
}
