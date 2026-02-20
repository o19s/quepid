import { Controller } from '@hotwired/stimulus';
import { apiFetch } from '../api/fetch';
import { getQuepidRootUrl, buildPageUrl } from 'utils/quepid_root';

export default class extends Controller {
  static targets = [
    'searchUrl',
    'testQuery',
    'testQueryHint',
    'httpMethod',
    'basicAuthCredential',
    'customHeaders',
    'apiKey',
    'htmlPreview',
    'htmlPreviewContainer',
    'numberOfResultsMapper',
    'docsMapper',
    'numberOfResultsResult',
    'docsResult',
    'numberOfResultsLogs',
    'numberOfResultsLogsContainer',
    'docsLogs',
    'docsLogsContainer',
    'status',
    'endpointName',
    'proxyRequests',
    'teamCheckbox',
    'step2',
    'step3',
    'fetchButton',
    'generateButton',
    'testNumberButton',
    'testDocsButton',
    'refineNumberButton',
    'refineDocsButton',
    'saveButton',
  ];

  static values = {
    fetchUrl: String,
    generateUrl: String,
    testUrl: String,
    refineUrl: String,
    saveUrl: String,
    hasExistingMappers: Boolean,
  };

  connect() {
    console.log('Mapper Wizard controller connected');
    // Editors will be initialized by the global CodeMirror auto-init
    // Store references when they become available
    this.numberOfResultsEditor = null;
    this.docsEditor = null;

    // Wait for CodeMirror to initialize the textareas
    setTimeout(() => this.captureEditors(), 500);

    // If editing an existing endpoint with mappers, show steps 2 and 3
    if (this.hasExistingMappersValue) {
      this.step2Target.classList.remove('d-none');
      this.step3Target.classList.remove('d-none');
      this.showStatus(
        'Existing mappers loaded. Fetch HTML to test them, or edit and save directly.',
        'info'
      );
    }
  }

  captureEditors() {
    if (this.hasNumberOfResultsMapperTarget && this.numberOfResultsMapperTarget.editor) {
      this.numberOfResultsEditor = this.numberOfResultsMapperTarget.editor;
    }
    if (this.hasDocsMapperTarget && this.docsMapperTarget.editor) {
      this.docsEditor = this.docsMapperTarget.editor;
    }
  }

  // Update the test query hint text and placeholder based on HTTP method
  updateTestQueryHint() {
    if (!this.hasHttpMethodTarget || !this.hasTestQueryHintTarget) return;

    const method = this.httpMethodTarget.value;
    const isPost = method === 'POST';

    if (isPost) {
      this.testQueryHintTarget.innerHTML =
        'Enter JSON body for POST request. Saved with endpoint for easy iteration.';
      if (this.hasTestQueryTarget) {
        this.testQueryTarget.placeholder = '{"query": "test", "size": 10}';
      }
    } else {
      this.testQueryHintTarget.innerHTML =
        'Enter query params (e.g., <code>q=test&rows=10</code>) appended to URL. Saved with endpoint for easy iteration.';
      if (this.hasTestQueryTarget) {
        this.testQueryTarget.placeholder = 'q=shirts&rows=10';
      }
    }
  }

  // Step 1: Fetch HTML
  async fetchHtml(event) {
    event.preventDefault();

    const url = this.searchUrlTarget.value.trim();
    if (!url) {
      this.showStatus('Please enter a search URL', 'error');
      return;
    }

    const httpMethod = this.hasHttpMethodTarget ? this.httpMethodTarget.value : 'GET';
    const testQuery = this.hasTestQueryTarget ? this.testQueryTarget.value.trim() : '';
    const customHeaders = this.hasCustomHeadersTarget ? this.customHeadersTarget.value.trim() : '';
    const basicAuthCredential = this.hasBasicAuthCredentialTarget
      ? this.basicAuthCredentialTarget.value.trim()
      : '';

    // Validate custom headers JSON if provided
    if (customHeaders) {
      try {
        JSON.parse(customHeaders);
      } catch (_e) {
        this.showStatus('Custom headers must be valid JSON', 'error');
        return;
      }
    }

    // Validate test query is valid JSON for POST requests
    if (httpMethod === 'POST' && testQuery) {
      try {
        JSON.parse(testQuery);
      } catch (_e) {
        this.showStatus('Test query must be valid JSON for POST requests', 'error');
        return;
      }
    }

    this.setButtonLoading(this.fetchButtonTarget, true);
    this.showStatus(`Fetching via ${httpMethod}...`, 'info');

    try {
      const response = await apiFetch(this.fetchUrlValue, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          search_url: url,
          http_method: httpMethod,
          test_query: testQuery,
          custom_headers: customHeaders,
          basic_auth_credential: basicAuthCredential,
        }),
      });

      const data = await response.json();

      if (data.success) {
        this.htmlPreviewTarget.textContent = data.html_preview;
        this.htmlPreviewContainerTarget.classList.remove('d-none');
        this.showStatus(
          `Response fetched successfully (${data.html_length.toLocaleString()} characters)`,
          'success'
        );
        this.step2Target.classList.remove('d-none');
      } else {
        this.showStatus(data.error || 'Failed to fetch response', 'error');
      }
    } catch (error) {
      this.showStatus(`Error: ${error.message}`, 'error');
    } finally {
      this.setButtonLoading(this.fetchButtonTarget, false);
    }
  }

  // Step 2: Generate Mappers with AI
  async generateMappers(event) {
    event.preventDefault();

    const apiKey = this.apiKeyTarget.value.trim();
    if (!apiKey) {
      this.showStatus('Please enter your OpenAI API key', 'error');
      return;
    }

    this.setButtonLoading(this.generateButtonTarget, true);
    this.showStatus('Generating mapper functions with AI... This may take a moment.', 'info');

    try {
      const response = await apiFetch(this.generateUrlValue, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey }),
      });

      const data = await response.json();

      if (data.success) {
        // Re-capture editors in case they weren't ready before
        this.captureEditors();

        // Update CodeMirror editors
        if (this.numberOfResultsEditor) {
          this.numberOfResultsEditor.setValue(data.number_of_results_mapper);
        } else if (this.hasNumberOfResultsMapperTarget) {
          this.numberOfResultsMapperTarget.value = data.number_of_results_mapper;
        }

        if (this.docsEditor) {
          this.docsEditor.setValue(data.docs_mapper);
        } else if (this.hasDocsMapperTarget) {
          this.docsMapperTarget.value = data.docs_mapper;
        }

        this.showStatus('Mapper functions generated successfully!', 'success');
        this.step3Target.classList.remove('d-none');
      } else {
        this.showStatus(data.error || 'Failed to generate mappers', 'error');
      }
    } catch (error) {
      this.showStatus(`Error: ${error.message}`, 'error');
    } finally {
      this.setButtonLoading(this.generateButtonTarget, false);
    }
  }

  // Test numberOfResultsMapper
  async testNumberOfResultsMapper(event) {
    event.preventDefault();
    await this.testMapper(
      'numberOfResultsMapper',
      this.numberOfResultsEditor,
      this.numberOfResultsMapperTarget,
      this.numberOfResultsResultTarget,
      this.testNumberButtonTarget,
      this.numberOfResultsLogsTarget,
      this.numberOfResultsLogsContainerTarget
    );
  }

  // Test docsMapper
  async testDocsMapper(event) {
    event.preventDefault();
    await this.testMapper(
      'docsMapper',
      this.docsEditor,
      this.docsMapperTarget,
      this.docsResultTarget,
      this.testDocsButtonTarget,
      this.docsLogsTarget,
      this.docsLogsContainerTarget
    );
  }

  async testMapper(
    mapperType,
    editor,
    textarea,
    resultTarget,
    button,
    logsTarget,
    logsContainerTarget
  ) {
    this.captureEditors();

    const code = editor ? editor.getValue() : textarea.value;
    if (!code.trim()) {
      this.showStatus(`Please enter ${mapperType} code first`, 'error');
      return;
    }

    this.setButtonLoading(button, true);

    try {
      const response = await apiFetch(this.testUrlValue, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mapper_type: mapperType,
          code: code,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const resultStr = JSON.stringify(data.result, null, 2);
        resultTarget.innerHTML = `<pre class="text-success mb-0 text-pre-wrap">${this.escapeHtml(resultStr)}</pre>`;
        this.showStatus(`${mapperType} test successful!`, 'success');
      } else {
        resultTarget.innerHTML = `<pre class="text-danger mb-0">${this.escapeHtml(data.error)}</pre>`;
        this.showStatus(`${mapperType} test failed`, 'error');
      }

      // Display console logs if any were captured
      this.displayLogs(data.logs, logsTarget, logsContainerTarget);
    } catch (error) {
      resultTarget.innerHTML = `<pre class="text-danger mb-0">Error: ${this.escapeHtml(error.message)}</pre>`;
    } finally {
      this.setButtonLoading(button, false);
    }
  }

  // Display captured console logs from JavaScript execution
  displayLogs(logs, logsTarget, logsContainerTarget) {
    if (!logs || logs.length === 0) {
      logsContainerTarget.classList.add('d-none');
      return;
    }

    logsContainerTarget.classList.remove('d-none');

    const logHtml = logs
      .map((log) => {
        const levelClass =
          log.level === 'error'
            ? 'text-danger'
            : log.level === 'warn'
              ? 'text-warning'
              : log.level === 'info'
                ? 'text-info'
                : 'text-light';
        const levelIcon =
          log.level === 'error'
            ? '[ERROR]'
            : log.level === 'warn'
              ? '[WARN]'
              : log.level === 'info'
                ? '[INFO]'
                : '[LOG]';
        return `<div class="${levelClass}">${this.escapeHtml(levelIcon)} ${this.escapeHtml(log.message)}</div>`;
      })
      .join('');

    logsTarget.innerHTML = logHtml;
  }

  // Refine numberOfResultsMapper with AI
  async refineNumberOfResultsMapper(event) {
    event.preventDefault();
    const feedback = prompt(
      'What would you like to improve about the numberOfResultsMapper function?'
    );
    if (feedback) {
      await this.refineMapper(
        'numberOfResultsMapper',
        this.numberOfResultsEditor,
        this.numberOfResultsMapperTarget,
        feedback,
        this.refineNumberButtonTarget
      );
    }
  }

  // Refine docsMapper with AI
  async refineDocsMapper(event) {
    event.preventDefault();
    const feedback = prompt('What would you like to improve about the docsMapper function?');
    if (feedback) {
      await this.refineMapper(
        'docsMapper',
        this.docsEditor,
        this.docsMapperTarget,
        feedback,
        this.refineDocsButtonTarget
      );
    }
  }

  async refineMapper(mapperType, editor, textarea, feedback, button) {
    const apiKey = this.apiKeyTarget.value.trim();
    if (!apiKey) {
      this.showStatus('Please enter your OpenAI API key', 'error');
      return;
    }

    this.captureEditors();
    const currentCode = editor ? editor.getValue() : textarea.value;

    this.setButtonLoading(button, true);
    this.showStatus(`Refining ${mapperType} with AI...`, 'info');

    try {
      const response = await apiFetch(this.refineUrlValue, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mapper_type: mapperType,
          current_code: currentCode,
          feedback: feedback,
          api_key: apiKey,
        }),
      });

      const data = await response.json();

      if (data.success) {
        if (editor) {
          editor.setValue(data.code);
        } else {
          textarea.value = data.code;
        }
        this.showStatus(`${mapperType} refined successfully!`, 'success');
      } else {
        this.showStatus(data.error || 'Refinement failed', 'error');
      }
    } catch (error) {
      this.showStatus(`Error: ${error.message}`, 'error');
    } finally {
      this.setButtonLoading(button, false);
    }
  }

  // Save to SearchEndpoint
  async save(event) {
    event.preventDefault();

    const name = this.endpointNameTarget.value.trim();
    if (!name) {
      this.showStatus('Please enter a name for the search endpoint', 'error');
      return;
    }

    this.captureEditors();

    const numberOfResultsMapper = this.numberOfResultsEditor
      ? this.numberOfResultsEditor.getValue()
      : this.numberOfResultsMapperTarget.value;
    const docsMapper = this.docsEditor ? this.docsEditor.getValue() : this.docsMapperTarget.value;

    if (!numberOfResultsMapper.trim() || !docsMapper.trim()) {
      this.showStatus('Both mapper functions are required', 'error');
      return;
    }

    this.setButtonLoading(this.saveButtonTarget, true);
    this.showStatus('Saving search endpoint...', 'info');

    const httpMethod = this.hasHttpMethodTarget ? this.httpMethodTarget.value : 'GET';
    const testQuery = this.hasTestQueryTarget ? this.testQueryTarget.value.trim() : '';
    const customHeaders = this.hasCustomHeadersTarget ? this.customHeadersTarget.value.trim() : '';
    const basicAuthCredential = this.hasBasicAuthCredentialTarget
      ? this.basicAuthCredentialTarget.value.trim()
      : '';

    // Collect checked team IDs
    const teamIds = this.hasTeamCheckboxTarget
      ? this.teamCheckboxTargets.filter((cb) => cb.checked).map((cb) => parseInt(cb.value))
      : [];

    try {
      const response = await apiFetch(this.saveUrlValue, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          number_of_results_mapper: numberOfResultsMapper,
          docs_mapper: docsMapper,
          endpoint_url: this.searchUrlTarget.value.trim(),
          api_method: httpMethod,
          proxy_requests: this.proxyRequestsTarget.checked,
          test_query: testQuery,
          custom_headers: customHeaders,
          basic_auth_credential: basicAuthCredential,
          team_ids: teamIds,
        }),
      });

      const data = await response.json();

      if (data.success) {
        this.showStatus('Search endpoint saved successfully! Redirecting...', 'success');
        const root = getQuepidRootUrl();
        window.location.href = buildPageUrl(root, 'search_endpoints', data.redirect_id);
      } else {
        this.showStatus(data.errors?.join(', ') || 'Save failed', 'error');
      }
    } catch (error) {
      this.showStatus(`Error: ${error.message}`, 'error');
    } finally {
      this.setButtonLoading(this.saveButtonTarget, false);
    }
  }

  // Toggle HTML preview expansion
  toggleHtmlPreview(event) {
    const container = this.htmlPreviewContainerTarget.querySelector('.html-preview');
    if (container) {
      const isExpanded = container.classList.toggle('expanded');
      event.currentTarget.textContent = isExpanded ? 'Collapse' : 'Expand';
    }
  }

  // Copy HTML preview content to clipboard
  async copyHtmlPreview(event) {
    event.preventDefault();

    // Capture button reference before any await - event.currentTarget becomes null after async operations
    const button = event.currentTarget;
    const originalHtml = button.innerHTML;

    const content = this.htmlPreviewTarget.textContent;
    if (!content) {
      this.showStatus('No content to copy', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(content);
      this.showStatus('Copied to clipboard!', 'success');

      // Briefly change button icon to show success
      button.innerHTML = '<i class="bi bi-clipboard-check"></i> Copied!';
      setTimeout(() => {
        button.innerHTML = originalHtml;
      }, 2000);
    } catch (error) {
      this.showStatus(`Failed to copy: ${error.message}`, 'error');
    }
  }

  // Helper methods
  showStatus(message, type) {
    if (this.hasStatusTarget) {
      this.statusTarget.textContent = message;
      this.statusTarget.className = `alert alert-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'info'}`;
      this.statusTarget.classList.remove('d-none');

      // Auto-hide success messages after 5 seconds
      if (type === 'success') {
        setTimeout(() => {
          if (this.statusTarget.textContent === message) {
            this.statusTarget.classList.add('d-none');
          }
        }, 5000);
      }
    }
  }

  setButtonLoading(button, loading) {
    if (loading) {
      button.disabled = true;
      button.dataset.originalText = button.innerHTML;
      button.innerHTML =
        '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...';
    } else {
      button.disabled = false;
      button.innerHTML = button.dataset.originalText || button.innerHTML;
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
