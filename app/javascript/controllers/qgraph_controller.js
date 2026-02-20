import { Controller } from '@hotwired/stimulus';
import * as d3 from 'd3';

// Renders a D3 sparkline graph of recent scores with annotation markers.
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

  static targets = ['svg'];

  connect() {
    // Wait a tick so the element has its CSS dimensions
    requestAnimationFrame(() => this._render());
    // Re-render when container is resized (e.g. panel expanded from collapsed)
    this._resizeObserver = new ResizeObserver(() => this._render());
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

    const el = this.hasSvgTarget ? this.svgTarget : this.element.querySelector('svg');
    if (!el) return;

    const margin = { top: 2, right: 13, bottom: 6, left: 2 };
    const rect = this.element.getBoundingClientRect();
    const height = (rect.height || 80) - margin.top - margin.bottom;
    const width = (rect.width || 150) - margin.left - margin.right;

    if (width <= 0 || height <= 0) return;

    // Sort and take last 10 scores
    const sorted = scores.slice().sort((a, b) => d3.ascending(a.updated_at, b.updated_at));
    const last10 = sorted.slice(-10);
    if (last10.length === 0) return;

    const minDate = new Date(last10[0].updated_at);

    // Build combined data array
    const data = [];
    last10.forEach((s) => {
      data.push({ type: 'score', score: s.score, updated_at: s.updated_at, message: null });
    });

    const annotations = this.annotationsValue || [];
    annotations.forEach((a) => {
      const dateStr = a.updated_at || a.updatedAt;
      if (dateStr && new Date(dateStr) >= minDate) {
        data.push({ type: 'annotation', score: null, updated_at: dateStr, message: a.message });
      }
    });

    data.sort((a, b) => d3.ascending(a.updated_at, b.updated_at));

    const scoreData = data.filter((d) => d.type === 'score' && d.score !== null);
    if (scoreData.length === 0) return;

    // Clear previous render
    const svg = d3.select(el);
    svg.selectAll('*').remove();
    svg
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleLinear()
      .domain([0, scoreData.length - 1])
      .range([0, width]);
    const y = d3.scaleLinear().domain([0, this.maxValue]).range([height, 0]);

    const line = d3
      .line()
      .x((_d, i) => x(i))
      .y((d) => y(d.score));

    g.append('path').attr('d', line(scoreData));

    // Hot points: interactive circles at each score with tooltip (score + date)
    scoreData.forEach((d, i) => {
      const xpos = x(i);
      const ypos = y(d.score);
      const dateStr = d.updated_at
        ? new Date(d.updated_at).toLocaleDateString(undefined, { dateStyle: 'medium' })
        : '';
      const tip = `Score: ${d.score}${dateStr ? ` on ${dateStr}` : ''}`;
      g.append('circle')
        .attr('class', 'qgraph-hot-point')
        .attr('cx', xpos)
        .attr('cy', ypos)
        .attr('r', 4)
        .style('fill', 'transparent')
        .style('pointer-events', 'all')
        .style('cursor', 'pointer')
        .append('title')
        .text(tip);
    });

    // Annotation markers
    data.forEach((d, i) => {
      if (d.type !== 'annotation' || !d.message) return;
      const xpos = (i / Math.max(data.length - 1, 1)) * width;
      g.append('line')
        .attr('class', 'marker')
        .attr('x1', xpos)
        .attr('x2', xpos)
        .attr('y1', 0)
        .attr('y2', height)
        .style('pointer-events', 'all')
        .append('title')
        .text(d.message);
    });
  }
}
