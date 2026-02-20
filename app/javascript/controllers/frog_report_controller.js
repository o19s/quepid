import { Controller } from '@hotwired/stimulus';
import vegaEmbed from 'vega-embed';
import { apiFetch } from 'api/fetch';
import { buildApiUrl, buildPageUrl, getQuepidRootUrl, reloadOrTurboVisit } from 'utils/quepid_root';

// Handles the Frog Pond Report modal: opens modal, renders Vega-Lite bar chart,
// and optionally refreshes ratings from a linked book.
// Replaces the Angular frog_report directive + FrogReportModalInstanceCtrl.
export default class extends Controller {
  static values = {
    caseId: Number,
    bookId: Number,
    queriesCount: Number,
    chartData: Array,
  };

  static targets = ['modal', 'chart', 'refreshBtn', 'errorEl'];

  connect() {
    this._modal = null;
    this._chartRendered = false;
  }

  get rootUrl() {
    return getQuepidRootUrl();
  }

  open(event) {
    event.preventDefault();
    if (!this._modal) {
      const el = this.modalTarget;
      this._modal =
        window.bootstrap?.Modal?.getOrCreateInstance(el) ?? new window.bootstrap.Modal(el);
    }
    this._hideError();
    this._modal.show();

    if (!this._chartRendered) {
      requestAnimationFrame(() => this._renderChart());
      this._chartRendered = true;
    }
  }

  async refreshFromBook(event) {
    event.preventDefault();
    const bookId = this.bookIdValue;
    if (!bookId) return;

    this._hideError();
    const inBackground = this.queriesCountValue >= 50;

    let query = 'create_missing_queries=false';
    if (inBackground) query += '&process_in_background=true';
    const url =
      buildApiUrl(this.rootUrl, 'books', bookId, 'cases', this.caseIdValue, 'refresh') +
      '?' +
      query;

    this.refreshBtnTarget.disabled = true;
    try {
      const res = await apiFetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || res.statusText);
      }
      if (window.flash)
        window.flash.success = inBackground
          ? 'Ratings are being refreshed in the background.'
          : 'Ratings have been refreshed.';
      this._modal?.hide();
      if (inBackground) {
        setTimeout(() => {
          window.location.href = buildPageUrl(this.rootUrl, '');
        }, 500);
      } else {
        reloadOrTurboVisit();
      }
    } catch (err) {
      this._showError(err.message || 'Failed to refresh ratings.');
    } finally {
      this.refreshBtnTarget.disabled = false;
    }
  }

  _renderChart() {
    const data = this.chartDataValue;
    if (!data || data.length === 0) return;

    const container = this.chartTarget;
    const width = 800;
    const height = 200;

    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      width,
      height,
      data: { values: data },
      params: [
        {
          name: 'barHover',
          select: { type: 'point', on: 'pointerover' },
        },
      ],
      encoding: {
        x: {
          field: 'category',
          type: 'nominal',
          title: 'Rating Status',
          axis: { labelAngle: -25, labelAlign: 'right' },
        },
        y: {
          field: 'amount',
          type: 'quantitative',
          title: 'Number Queries',
        },
      },
      layer: [
        {
          mark: { type: 'bar', cornerRadiusTop: 2 },
          encoding: {
            fill: {
              condition: { param: 'barHover', value: 'red' },
              value: 'steelblue',
            },
            tooltip: [
              { field: 'category', type: 'nominal', title: 'Rating Status' },
              { field: 'amount', type: 'quantitative', title: 'Count' },
            ],
          },
        },
        {
          mark: { type: 'text', align: 'middle', baseline: 'bottom', dy: -4, fontSize: 11 },
          encoding: {
            text: { field: 'amount', type: 'quantitative' },
          },
        },
      ],
    };

    container.innerHTML = '';
    vegaEmbed(container, spec, { actions: false }).catch((err) => {
      console.error('frog_report vegaEmbed error', err);
    });
  }

  _hideError() {
    if (this.hasErrorElTarget) {
      this.errorElTarget.classList.add('d-none');
      this.errorElTarget.textContent = '';
    }
  }

  _showError(msg) {
    if (this.hasErrorElTarget) {
      this.errorElTarget.textContent = msg;
      this.errorElTarget.classList.remove('d-none');
    }
  }
}
