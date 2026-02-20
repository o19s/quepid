import { Controller } from '@hotwired/stimulus';
import { apiFetch } from 'api/fetch';
import { getQuepidRootUrl, buildApiUrl, buildPageUrl, reloadOrTurboVisit } from 'utils/quepid_root';

// Toggles the settings panel and handles saving try query params.
// Replaces SettingsCtrl and CurrSettingsCtrl.
export default class extends Controller {
  static values = {
    caseId: Number,
    tryNumber: Number,
    curatorVars: Object,
    searchEngine: String,
    triesCount: Number,
  };
  static targets = [
    'trigger',
    'panel',
    'paramsForm',
    'queryParams',
    'escapeQuery',
    'numberOfRows',
    'curatorVarsContainer',
    'urlValidationFeedback',
    'queryParamsFeedback',
    'endpointSelect',
    'templateCallFeedback',
    'tryHistoryToggle',
  ];

  connect() {
    this._renderCuratorVarInputs();
    this._initCodeMirror();
    this._checkTemplateCall();
    this._tryHistoryExpanded = false;
    this._validationFeedbackTimer = null;
  }

  disconnect() {
    if (this._validationFeedbackTimer) {
      clearTimeout(this._validationFeedbackTimer);
    }
  }

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

  extractVars() {
    this._renderCuratorVarInputs();
  }

  async duplicateTry(event) {
    const tryNumber = event.currentTarget.dataset.tryNumber;
    if (!tryNumber || !this.caseIdValue) return;

    try {
      const root = getQuepidRootUrl();
      const url = buildApiUrl(root, 'cases', this.caseIdValue, 'tries');
      const res = await apiFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ parent_try_number: tryNumber, try: {} }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.message || `Duplicate failed (${res.status})`);
      }
      const data = await res.json();
      const newTryNumber = data.try_number;
      window.location.href = buildPageUrl(root, 'case', this.caseIdValue, 'try', newTryNumber);
    } catch (err) {
      console.error('Duplicate try failed:', err);
      if (window.flash) window.flash.error = err.message;
    }
  }

  async changeEndpoint() {
    if (!this.hasEndpointSelectTarget || !this.caseIdValue || !this.tryNumberValue) return;

    const endpointId = parseInt(this.endpointSelectTarget.value, 10);
    if (!endpointId) return;

    try {
      const root = getQuepidRootUrl();
      const url = buildApiUrl(root, 'cases', this.caseIdValue, 'tries', this.tryNumberValue);
      const res = await apiFetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ try: { search_endpoint_id: endpointId } }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.message || `Endpoint change failed (${res.status})`);
      }
      reloadOrTurboVisit();
    } catch (err) {
      console.error('Change endpoint failed:', err);
      if (window.flash) window.flash.error = err.message;
    }
  }

  async deleteTry(event) {
    const tryNumber = event.currentTarget.dataset.tryNumber;
    if (!tryNumber || !this.caseIdValue) return;
    if (this.triesCountValue <= 1) {
      if (window.flash) window.flash.error = 'Cannot delete the only try in a case.';
      return;
    }
    if (!confirm(`Delete Try ${tryNumber}? This cannot be undone.`)) return;

    try {
      const root = getQuepidRootUrl();
      const url = buildApiUrl(root, 'cases', this.caseIdValue, 'tries', tryNumber);
      const res = await apiFetch(url, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.message || `Delete failed (${res.status})`);
      }
      // If we just deleted the try we're currently viewing, navigate to case root
      // (which loads the latest try) instead of reloading (which would 404).
      const currentTry = String(this.tryNumberValue);
      if (String(tryNumber) === currentTry) {
        const root = getQuepidRootUrl();
        window.location.href = buildPageUrl(root, 'case', this.caseIdValue);
      } else {
        reloadOrTurboVisit();
      }
    } catch (err) {
      console.error('Delete try failed:', err);
      if (window.flash) window.flash.error = err.message;
    }
  }

  toggleTryHistory() {
    const extras = this.element.querySelectorAll('.js-try-history-extra');
    if (extras.length === 0) return;

    this._tryHistoryExpanded = !this._tryHistoryExpanded;
    extras.forEach((el) => el.classList.toggle('d-none', !this._tryHistoryExpanded));

    if (this.hasTryHistoryToggleTarget) {
      this.tryHistoryToggleTarget.textContent = this._tryHistoryExpanded
        ? 'Show fewer tries'
        : `Show all ${this.triesCountValue} tries`;
    }
  }

  async saveParams(event) {
    event.preventDefault();

    if (!this.caseIdValue || !this.tryNumberValue) return;

    // Sync CodeMirror value back to textarea before reading
    if (this.hasQueryParamsTarget && this.queryParamsTarget.editor) {
      this.queryParamsTarget.value = this.queryParamsTarget.editor.getValue();
    }

    const curatorVars = this._collectCuratorVars();
    const body = {
      try: {
        query_params: this.hasQueryParamsTarget ? this.queryParamsTarget.value : '',
        escape_query: this.hasEscapeQueryTarget ? this.escapeQueryTarget.checked : false,
        number_of_rows: this.hasNumberOfRowsTarget
          ? parseInt(this.numberOfRowsTarget.value, 10) || 10
          : 10,
      },
    };
    if (Object.keys(curatorVars).length > 0) {
      body.curator_vars = curatorVars;
    }

    try {
      const root = getQuepidRootUrl();
      const url = buildApiUrl(root, 'cases', this.caseIdValue, 'tries', this.tryNumberValue);

      const res = await apiFetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.message || `Update failed (${res.status})`);
      }

      // Try params change means all searches need re-running
      reloadOrTurboVisit();
    } catch (err) {
      console.error('Save query params failed:', err);
      if (window.flash) window.flash.error = err.message;
    }
  }

  async validateUrl() {
    if (!this.hasUrlValidationFeedbackTarget) return;
    const feedback = this.urlValidationFeedbackTarget;

    // Extract the search URL from the panel display
    const urlEl = this.element.querySelector('code.small');
    const url = urlEl?.textContent?.trim();
    if (!url) {
      this._showValidationFeedback(feedback, 'warning', 'No search URL configured');
      return;
    }

    this._showValidationFeedback(
      feedback,
      'info',
      '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Testing connection…'
    );

    try {
      const root = getQuepidRootUrl();
      const apiUrl = buildApiUrl(root, 'search_endpoints', 'validation');
      const res = await apiFetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();

      if (data.valid) {
        let msg = '<i class="bi bi-check-circle-fill text-success"></i> Connection successful';
        if (data.warnings?.length) {
          msg +=
            '<br>' +
            data.warnings
              .map(
                (w) =>
                  `<small class="text-warning"><i class="bi bi-exclamation-triangle"></i> ${this._escapeHtml(w)}</small>`
              )
              .join('<br>');
        }
        this._showValidationFeedback(feedback, 'success', msg);
      } else {
        this._showValidationFeedback(
          feedback,
          'danger',
          `<i class="bi bi-x-circle-fill"></i> ${this._escapeHtml(data.error || 'Connection failed')}`
        );
      }
    } catch (err) {
      this._showValidationFeedback(
        feedback,
        'danger',
        `<i class="bi bi-x-circle-fill"></i> ${this._escapeHtml(err.message)}`
      );
    }
  }

  validateQueryParams() {
    if (!this.hasQueryParamsFeedbackTarget || !this.hasQueryParamsTarget) return;
    const feedback = this.queryParamsFeedbackTarget;
    const text = this.queryParamsTarget.value.trim();

    if (!text) {
      feedback.classList.add('d-none');
      return;
    }

    const engine = (this.searchEngineValue || '').toLowerCase();

    // Solr: check for common case-sensitivity typos
    if (engine === 'solr') {
      const typos = this._checkSolrParamTypos(text);
      if (typos.length > 0) {
        const msgs = typos.map(
          (t) =>
            `<i class="bi bi-exclamation-triangle"></i> Did you mean <code>${this._escapeHtml(t.correct)}</code> instead of <code>${this._escapeHtml(t.found)}</code>?`
        );
        this._showValidationFeedback(feedback, 'warning', msgs.join('<br>'));
      } else {
        feedback.classList.add('d-none');
      }
      return;
    }

    // ES/OS: validate JSON syntax
    const jsonEngines = ['es', 'os', 'elasticsearch', 'opensearch'];
    if (!jsonEngines.some((e) => engine.includes(e))) {
      feedback.classList.add('d-none');
      return;
    }

    try {
      JSON.parse(text);
      this._showValidationFeedback(
        feedback,
        'success',
        '<i class="bi bi-check-circle"></i> Valid JSON'
      );
      if (this._validationFeedbackTimer) clearTimeout(this._validationFeedbackTimer);
      this._validationFeedbackTimer = setTimeout(() => {
        this._validationFeedbackTimer = null;
        feedback.classList.add('d-none');
      }, 2000);
    } catch (err) {
      this._showValidationFeedback(
        feedback,
        'warning',
        `<i class="bi bi-exclamation-triangle"></i> Invalid JSON: ${this._escapeHtml(err.message)}`
      );
    }
  }

  // Check for common Solr parameter case-sensitivity mistakes
  _checkSolrParamTypos(text) {
    const correctParams = [
      'defType',
      'echoParams',
      'debugQuery',
      'timeAllowed',
      'segmentTerminateEarly',
      'queryText',
      'wt',
      'omitHeader',
      'logParamsList',
      'fl',
      'pf',
      'pf2',
      'pf3',
      'ps',
      'ps2',
      'ps3',
      'qf',
      'qs',
      'bq',
      'bf',
      'boost',
      'mm',
      'lowercaseOperators',
      'stopwords',
      'uf',
    ];
    const typos = [];
    const params = text.split(/[&\n]/);

    for (const param of params) {
      const eqIdx = param.indexOf('=');
      if (eqIdx < 0) continue;
      const key = param.substring(0, eqIdx).trim();
      if (!key) continue;

      for (const correct of correctParams) {
        if (key !== correct && key.toLowerCase() === correct.toLowerCase()) {
          typos.push({ found: key, correct });
          break;
        }
      }
    }
    return typos;
  }

  _showValidationFeedback(el, type, html) {
    el.className = `small mb-2 alert alert-${type} py-1 px-2`;
    el.innerHTML = html;
    el.classList.remove('d-none');
  }

  _escapeHtml(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  _escapeHtmlAttr(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Extract ##varName## placeholders from query params text
  _extractCuratorVars() {
    if (!this.hasQueryParamsTarget) return [];
    const text = this.queryParamsTarget.value || '';
    const regex = /##([^#]+?)##/g;
    const vars = [];
    const seen = new Set();
    let match;
    while ((match = regex.exec(text)) !== null) {
      const name = match[1];
      if (!seen.has(name)) {
        seen.add(name);
        vars.push(name);
      }
    }
    return vars;
  }

  // Render labeled inputs for each curator variable found in query params
  _renderCuratorVarInputs() {
    if (!this.hasCuratorVarsContainerTarget) return;
    const varNames = this._extractCuratorVars();
    if (varNames.length === 0) {
      this.curatorVarsContainerTarget.replaceChildren();
      return;
    }

    const savedVars = this.curatorVarsValue || {};
    const headingId = `curator-vars-heading-${Date.now()}`;
    const heading = document.createElement('h6');
    heading.className = 'card-title mt-2 small text-muted';
    heading.id = headingId;
    heading.textContent = 'Curator variables';

    const fragment = document.createDocumentFragment();
    fragment.appendChild(heading);

    varNames.forEach((name, index) => {
      const value = savedVars[name] ?? '';
      const wrapper = document.createElement('div');
      wrapper.className = 'mb-2';

      const label = document.createElement('label');
      label.className = 'form-label small text-muted mb-1';
      const inputId = `curator-var-${index}`;
      label.id = `${inputId}-label`;
      label.setAttribute('for', inputId);
      const code = document.createElement('code');
      code.textContent = `##${name}##`;
      label.appendChild(code);

      const input = document.createElement('input');
      input.type = 'text';
      input.id = inputId;
      input.className = 'form-control form-control-sm';
      input.dataset.curatorVarName = name;
      input.setAttribute('data-action', 'input->settings-panel#autoGrowInput');
      input.setAttribute('aria-describedby', label.id);
      input.setAttribute('aria-label', `Value for curator variable ${name}`);
      input.style.width = 'auto';
      input.style.minWidth = '50px';
      input.style.maxWidth = '200px';
      input.value = String(value);

      wrapper.appendChild(label);
      wrapper.appendChild(input);
      fragment.appendChild(wrapper);
    });

    this.curatorVarsContainerTarget.replaceChildren(fragment);

    // Set initial widths based on existing values
    this.curatorVarsContainerTarget.querySelectorAll('[data-curator-var-name]').forEach((input) => {
      this._autoSizeInput(input);
    });
  }

  // Initialize CodeMirror on the query params textarea if available
  _initCodeMirror() {
    if (!this.hasQueryParamsTarget) return;
    const textarea = this.queryParamsTarget;
    if (textarea.editor) return; // already initialized

    if (window.CodeMirror && textarea.dataset.codemirrorMode) {
      window.CodeMirror.fromTextArea(textarea, {
        mode: textarea.dataset.codemirrorMode,
        lineNumbers: true,
        height: 200,
      });
    }
  }

  // Check if search URL contains _search/template and show warning
  _checkTemplateCall() {
    if (!this.hasTemplateCallFeedbackTarget) return;
    const urlEl = this.element.querySelector('code.small');
    const url = urlEl?.textContent?.trim() || '';
    if (url.includes('_search/template')) {
      this.templateCallFeedbackTarget.classList.remove('d-none');
    } else {
      this.templateCallFeedbackTarget.classList.add('d-none');
    }
  }

  // Auto-grow curator variable input width based on content
  autoGrowInput(event) {
    this._autoSizeInput(event.target);
  }

  _autoSizeInput(input) {
    const length = (input.value || '').length;
    input.style.width = `${Math.max(50, Math.min(200, length * 8 + 30))}px`;
  }

  // Collect current curator variable values from the rendered inputs
  _collectCuratorVars() {
    if (!this.hasCuratorVarsContainerTarget) return {};
    const inputs = this.curatorVarsContainerTarget.querySelectorAll('[data-curator-var-name]');
    const vars = {};
    inputs.forEach((input) => {
      vars[input.dataset.curatorVarName] = input.value;
    });
    return vars;
  }
}
