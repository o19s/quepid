import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = [
    "searchUrl",
    "queryParams",
    "httpMethod",
    "requestBody",
    "requestBodyContainer",
    "apiKey",
    "htmlPreview",
    "htmlPreviewContainer",
    "numberOfResultsMapper",
    "docsMapper",
    "numberOfResultsResult",
    "docsResult",
    "numberOfResultsLogs",
    "numberOfResultsLogsContainer",
    "docsLogs",
    "docsLogsContainer",
    "status",
    "endpointName",
    "proxyRequests",
    "step2",
    "step3",
    "fetchButton",
    "generateButton",
    "testNumberButton",
    "testDocsButton",
    "refineNumberButton",
    "refineDocsButton",
    "saveButton"
  ]

  static values = {
    fetchUrl: String,
    generateUrl: String,
    testUrl: String,
    refineUrl: String,
    saveUrl: String,
    hasExistingMappers: Boolean
  }

  connect() {
    console.log("Mapper Wizard controller connected")
    // Editors will be initialized by the global CodeMirror auto-init
    // Store references when they become available
    this.numberOfResultsEditor = null
    this.docsEditor = null
    this.requestBodyEditor = null

    // Wait for CodeMirror to initialize the textareas
    setTimeout(() => this.captureEditors(), 500)

    // Initialize request body visibility based on current HTTP method
    this.toggleRequestBody()

    // If editing an existing endpoint with mappers, show steps 2 and 3
    if (this.hasExistingMappersValue) {
      this.step2Target.style.display = "block"
      this.step3Target.style.display = "block"
      this.showStatus("Existing mappers loaded. Fetch HTML to test them, or edit and save directly.", "info")
    }
  }

  captureEditors() {
    if (this.hasNumberOfResultsMapperTarget && this.numberOfResultsMapperTarget.editor) {
      this.numberOfResultsEditor = this.numberOfResultsMapperTarget.editor
    }
    if (this.hasDocsMapperTarget && this.docsMapperTarget.editor) {
      this.docsEditor = this.docsMapperTarget.editor
    }
    if (this.hasRequestBodyTarget && this.requestBodyTarget.editor) {
      this.requestBodyEditor = this.requestBodyTarget.editor
    }
  }

  // Toggle visibility of request body based on HTTP method
  toggleRequestBody() {
    if (this.hasHttpMethodTarget && this.hasRequestBodyContainerTarget) {
      const method = this.httpMethodTarget.value
      this.requestBodyContainerTarget.style.display = method === 'POST' ? 'flex' : 'none'
    }
  }

  // Step 1: Fetch HTML
  async fetchHtml(event) {
    event.preventDefault()

    const url = this.searchUrlTarget.value.trim()
    if (!url) {
      this.showStatus("Please enter a search URL", "error")
      return
    }

    const httpMethod = this.hasHttpMethodTarget ? this.httpMethodTarget.value : 'GET'
    const queryParams = this.hasQueryParamsTarget ? this.queryParamsTarget.value.trim() : ''

    // Get request body for POST requests
    this.captureEditors()
    let requestBody = ''
    if (httpMethod === 'POST' && this.hasRequestBodyTarget) {
      requestBody = this.requestBodyEditor
        ? this.requestBodyEditor.getValue()
        : this.requestBodyTarget.value
    }

    this.setButtonLoading(this.fetchButtonTarget, true)
    const fetchInfo = queryParams ? `${httpMethod} with query params` : httpMethod
    this.showStatus(`Fetching via ${fetchInfo}...`, "info")

    try {
      const response = await fetch(this.fetchUrlValue, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": this.getCSRFToken()
        },
        body: JSON.stringify({
          search_url: url,
          http_method: httpMethod,
          request_body: requestBody,
          query_params: queryParams
        })
      })

      const data = await response.json()

      if (data.success) {
        this.htmlPreviewTarget.textContent = data.html_preview
        this.htmlPreviewContainerTarget.style.display = "block"
        this.showStatus(`Response fetched successfully (${data.html_length.toLocaleString()} characters)`, "success")
        this.step2Target.style.display = "block"
      } else {
        this.showStatus(data.error || "Failed to fetch response", "error")
      }
    } catch (error) {
      this.showStatus(`Error: ${error.message}`, "error")
    } finally {
      this.setButtonLoading(this.fetchButtonTarget, false)
    }
  }

  // Step 2: Generate Mappers with AI
  async generateMappers(event) {
    event.preventDefault()

    const apiKey = this.apiKeyTarget.value.trim()
    if (!apiKey) {
      this.showStatus("Please enter your OpenAI API key", "error")
      return
    }

    this.setButtonLoading(this.generateButtonTarget, true)
    this.showStatus("Generating mapper functions with AI... This may take a moment.", "info")

    try {
      const response = await fetch(this.generateUrlValue, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": this.getCSRFToken()
        },
        body: JSON.stringify({ api_key: apiKey })
      })

      const data = await response.json()

      if (data.success) {
        // Re-capture editors in case they weren't ready before
        this.captureEditors()

        // Update CodeMirror editors
        if (this.numberOfResultsEditor) {
          this.numberOfResultsEditor.setValue(data.number_of_results_mapper)
        } else if (this.hasNumberOfResultsMapperTarget) {
          this.numberOfResultsMapperTarget.value = data.number_of_results_mapper
        }

        if (this.docsEditor) {
          this.docsEditor.setValue(data.docs_mapper)
        } else if (this.hasDocsMapperTarget) {
          this.docsMapperTarget.value = data.docs_mapper
        }

        this.showStatus("Mapper functions generated successfully!", "success")
        this.step3Target.style.display = "block"
      } else {
        this.showStatus(data.error || "Failed to generate mappers", "error")
      }
    } catch (error) {
      this.showStatus(`Error: ${error.message}`, "error")
    } finally {
      this.setButtonLoading(this.generateButtonTarget, false)
    }
  }

  // Test numberOfResultsMapper
  async testNumberOfResultsMapper(event) {
    event.preventDefault()
    await this.testMapper(
      'numberOfResultsMapper',
      this.numberOfResultsEditor,
      this.numberOfResultsMapperTarget,
      this.numberOfResultsResultTarget,
      this.testNumberButtonTarget,
      this.numberOfResultsLogsTarget,
      this.numberOfResultsLogsContainerTarget
    )
  }

  // Test docsMapper
  async testDocsMapper(event) {
    event.preventDefault()
    await this.testMapper(
      'docsMapper',
      this.docsEditor,
      this.docsMapperTarget,
      this.docsResultTarget,
      this.testDocsButtonTarget,
      this.docsLogsTarget,
      this.docsLogsContainerTarget
    )
  }

  async testMapper(mapperType, editor, textarea, resultTarget, button, logsTarget, logsContainerTarget) {
    this.captureEditors()

    const code = editor ? editor.getValue() : textarea.value
    if (!code.trim()) {
      this.showStatus(`Please enter ${mapperType} code first`, "error")
      return
    }

    this.setButtonLoading(button, true)

    try {
      const response = await fetch(this.testUrlValue, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": this.getCSRFToken()
        },
        body: JSON.stringify({
          mapper_type: mapperType,
          code: code
        })
      })

      const data = await response.json()

      if (data.success) {
        const resultStr = JSON.stringify(data.result, null, 2)
        resultTarget.innerHTML = `<pre class="text-success mb-0" style="white-space: pre-wrap;">${this.escapeHtml(resultStr)}</pre>`
        this.showStatus(`${mapperType} test successful!`, "success")
      } else {
        resultTarget.innerHTML = `<pre class="text-danger mb-0">${this.escapeHtml(data.error)}</pre>`
        this.showStatus(`${mapperType} test failed`, "error")
      }

      // Display console logs if any were captured
      this.displayLogs(data.logs, logsTarget, logsContainerTarget)
    } catch (error) {
      resultTarget.innerHTML = `<pre class="text-danger mb-0">Error: ${this.escapeHtml(error.message)}</pre>`
    } finally {
      this.setButtonLoading(button, false)
    }
  }

  // Display captured console logs from JavaScript execution
  displayLogs(logs, logsTarget, logsContainerTarget) {
    if (!logs || logs.length === 0) {
      logsContainerTarget.style.display = "none"
      return
    }

    logsContainerTarget.style.display = "block"

    const logHtml = logs.map(log => {
      const levelClass = log.level === 'error' ? 'text-danger' :
                         log.level === 'warn' ? 'text-warning' :
                         log.level === 'info' ? 'text-info' : 'text-light'
      const levelIcon = log.level === 'error' ? '[ERROR]' :
                        log.level === 'warn' ? '[WARN]' :
                        log.level === 'info' ? '[INFO]' : '[LOG]'
      return `<div class="${levelClass}">${this.escapeHtml(levelIcon)} ${this.escapeHtml(log.message)}</div>`
    }).join('')

    logsTarget.innerHTML = logHtml
  }

  // Refine numberOfResultsMapper with AI
  async refineNumberOfResultsMapper(event) {
    event.preventDefault()
    const feedback = prompt("What would you like to improve about the numberOfResultsMapper function?")
    if (feedback) {
      await this.refineMapper(
        'numberOfResultsMapper',
        this.numberOfResultsEditor,
        this.numberOfResultsMapperTarget,
        feedback,
        this.refineNumberButtonTarget
      )
    }
  }

  // Refine docsMapper with AI
  async refineDocsMapper(event) {
    event.preventDefault()
    const feedback = prompt("What would you like to improve about the docsMapper function?")
    if (feedback) {
      await this.refineMapper(
        'docsMapper',
        this.docsEditor,
        this.docsMapperTarget,
        feedback,
        this.refineDocsButtonTarget
      )
    }
  }

  async refineMapper(mapperType, editor, textarea, feedback, button) {
    const apiKey = this.apiKeyTarget.value.trim()
    if (!apiKey) {
      this.showStatus("Please enter your OpenAI API key", "error")
      return
    }

    this.captureEditors()
    const currentCode = editor ? editor.getValue() : textarea.value

    this.setButtonLoading(button, true)
    this.showStatus(`Refining ${mapperType} with AI...`, "info")

    try {
      const response = await fetch(this.refineUrlValue, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": this.getCSRFToken()
        },
        body: JSON.stringify({
          mapper_type: mapperType,
          current_code: currentCode,
          feedback: feedback,
          api_key: apiKey
        })
      })

      const data = await response.json()

      if (data.success) {
        if (editor) {
          editor.setValue(data.code)
        } else {
          textarea.value = data.code
        }
        this.showStatus(`${mapperType} refined successfully!`, "success")
      } else {
        this.showStatus(data.error || "Refinement failed", "error")
      }
    } catch (error) {
      this.showStatus(`Error: ${error.message}`, "error")
    } finally {
      this.setButtonLoading(button, false)
    }
  }

  // Save to SearchEndpoint
  async save(event) {
    event.preventDefault()

    const name = this.endpointNameTarget.value.trim()
    if (!name) {
      this.showStatus("Please enter a name for the search endpoint", "error")
      return
    }

    this.captureEditors()

    const numberOfResultsMapper = this.numberOfResultsEditor
      ? this.numberOfResultsEditor.getValue()
      : this.numberOfResultsMapperTarget.value
    const docsMapper = this.docsEditor
      ? this.docsEditor.getValue()
      : this.docsMapperTarget.value

    if (!numberOfResultsMapper.trim() || !docsMapper.trim()) {
      this.showStatus("Both mapper functions are required", "error")
      return
    }

    this.setButtonLoading(this.saveButtonTarget, true)
    this.showStatus("Saving search endpoint...", "info")

    const httpMethod = this.hasHttpMethodTarget ? this.httpMethodTarget.value : 'GET'

    try {
      const response = await fetch(this.saveUrlValue, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": this.getCSRFToken()
        },
        body: JSON.stringify({
          name: name,
          number_of_results_mapper: numberOfResultsMapper,
          docs_mapper: docsMapper,
          endpoint_url: this.searchUrlTarget.value.trim(),
          api_method: httpMethod,
          proxy_requests: this.proxyRequestsTarget.checked
        })
      })

      const data = await response.json()

      if (data.success) {
        this.showStatus("Search endpoint saved successfully! Redirecting...", "success")
        window.location.href = data.redirect_url
      } else {
        this.showStatus(data.errors?.join(", ") || "Save failed", "error")
      }
    } catch (error) {
      this.showStatus(`Error: ${error.message}`, "error")
    } finally {
      this.setButtonLoading(this.saveButtonTarget, false)
    }
  }

  // Toggle HTML preview expansion
  toggleHtmlPreview(event) {
    const container = this.htmlPreviewContainerTarget.querySelector('.html-preview')
    if (container) {
      const isExpanded = container.classList.toggle("expanded")
      event.currentTarget.textContent = isExpanded ? "Collapse" : "Expand"
    }
  }

  // Copy HTML preview content to clipboard
  async copyHtmlPreview(event) {
    event.preventDefault()

    // Capture button reference before any await - event.currentTarget becomes null after async operations
    const button = event.currentTarget
    const originalHtml = button.innerHTML

    const content = this.htmlPreviewTarget.textContent
    if (!content) {
      this.showStatus("No content to copy", "error")
      return
    }

    try {
      await navigator.clipboard.writeText(content)
      this.showStatus("Copied to clipboard!", "success")

      // Briefly change button icon to show success
      button.innerHTML = '<i class="bi bi-clipboard-check"></i> Copied!'
      setTimeout(() => {
        button.innerHTML = originalHtml
      }, 2000)
    } catch (error) {
      this.showStatus(`Failed to copy: ${error.message}`, "error")
    }
  }

  // Helper methods
  showStatus(message, type) {
    if (this.hasStatusTarget) {
      this.statusTarget.textContent = message
      this.statusTarget.className = `alert alert-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'info'}`
      this.statusTarget.style.display = "block"

      // Auto-hide success messages after 5 seconds
      if (type === 'success') {
        setTimeout(() => {
          if (this.statusTarget.textContent === message) {
            this.statusTarget.style.display = "none"
          }
        }, 5000)
      }
    }
  }

  setButtonLoading(button, loading) {
    if (loading) {
      button.disabled = true
      button.dataset.originalText = button.innerHTML
      button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...'
    } else {
      button.disabled = false
      button.innerHTML = button.dataset.originalText || button.innerHTML
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  getCSRFToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content
  }
}
