import { Controller } from '@hotwired/stimulus';
import vegaEmbed from 'vega-embed';

// Renders a Vega-Lite sparkline of recent scores with annotation markers.
// Replaces the Angular qgraph directive + QgraphCtrl.
//
// Scores and annotations are passed as JSON via Stimulus values. The graph
// shows up to 10 most recent scores and any annotations within that time range.
export default class extends Controller {
  static values = {
    scores: { type: Array, default: [] },
    annotations: { type: Array, default: [] },
    max: { type: Number, default: 100 },
  };

  static targets = ['chart'];

  connect() {
    requestAnimationFrame(() => this._render());
    this._resizeScheduled = false;
    this._resizeObserver = new ResizeObserver(() => {
      if (this._resizeScheduled) return;
      this._resizeScheduled = true;
      requestAnimationFrame(() => {
        this._resizeScheduled = false;
        this._render();
      });
    });
    this._resizeObserver.observe(this.element);
  }

  disconnect() {
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
  }

  scoresValueChanged() {
    if (this._connected) this._render();
  }
  annotationsValueChanged() {
    if (this._connected) this._render();
  }
  maxValueChanged() {
    if (this._connected) this._render();
  }

  _render() {
    this._connected = true;
    const scores = this.scoresValue || [];
    if (scores.length < 2 || !this.maxValue) return;

    const container = this.hasChartTarget
      ? this.chartTarget
      : this.element.querySelector('[data-qgraph-target="chart"]');
    if (!container) return;

    const margin = { top: 2, right: 13, bottom: 6, left: 2 };
    const rect = this.element.getBoundingClientRect();
    const height = (rect.height || 80) - margin.top - margin.bottom;
    const width = (rect.width || 150) - margin.left - margin.right;

    if (width <= 0 || height <= 0) return;

    const sorted = scores
      .slice()
      .sort((a, b) => (a.updated_at < b.updated_at ? -1 : a.updated_at > b.updated_at ? 1 : 0));
    const last10 = sorted.slice(-10);
    if (last10.length === 0) return;

    const minDate = new Date(last10[0].updated_at);

    const scoreData = last10.map((s) => {
      const dateStr = s.updated_at
        ? new Date(s.updated_at).toLocaleDateString(undefined, { dateStyle: 'medium' })
        : '';
      return {
        updated_at: s.updated_at,
        score: s.score,
        tip: `Score: ${s.score}${dateStr ? ` on ${dateStr}` : ''}`,
      };
    });

    const annotations = this.annotationsValue || [];
    const annotationData = annotations
      .filter((a) => {
        const dateStr = a.updated_at || a.updatedAt;
        return dateStr && new Date(dateStr) >= minDate && a.message;
      })
      .map((a) => ({
        updated_at: a.updated_at || a.updatedAt,
        message: a.message,
      }));

    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      width,
      height,
      config: { axis: null },
      layer: [
        {
          data: { values: scoreData },
          mark: { type: 'line', point: false, strokeWidth: 2 },
          encoding: {
            x: { field: 'updated_at', type: 'temporal', axis: null },
            y: {
              field: 'score',
              type: 'quantitative',
              scale: { domain: [0, this.maxValue] },
              axis: null,
            },
          },
        },
        {
          data: { values: scoreData },
          mark: { type: 'point', size: 80, fill: 'transparent', stroke: 'transparent' },
          encoding: {
            x: { field: 'updated_at', type: 'temporal' },
            y: { field: 'score', type: 'quantitative' },
            tooltip: { field: 'tip', type: 'nominal' },
          },
        },
        ...(annotationData.length > 0
          ? [
              {
                data: { values: annotationData },
                mark: { type: 'rule', strokeWidth: 4, strokeOpacity: 0.3 },
                encoding: {
                  x: { field: 'updated_at', type: 'temporal' },
                  tooltip: { field: 'message', type: 'nominal' },
                },
              },
            ]
          : []),
      ],
    };

    container.innerHTML = '';
    vegaEmbed(container, spec, { actions: false }).catch((err) => {
      console.error('qgraph vegaEmbed error', err);
    });
  }
}
