import { Controller } from "@hotwired/stimulus"
import { HttpError } from "api/http_error"
import { postJson } from "api/json"
import { showStatusMessage } from "utils/status_message"

export default class extends Controller {
  static targets = [
    "searchUrl",
    "testQuery",
    "testQueryHint",
    "httpMethod",
    "basicAuthCredential",
    "customHeaders",
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
    "teamCheckbox",
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
    // If editing an existing endpoint with mappers, show steps 2 and 3
    if (this.hasExistingMappersValue) {
      this.step2Target.style.display = "block"
      this.step3Target.style.display = "block"
      this.showStatus("Existing mappers loaded. Fetch HTML to test them, or edit and save directly.", "info")
    }
  }

  // Lets a user without an OpenAI key (or who just prefers to write the mapper by hand) reach
  // Step 3 directly, instead of it only ever being revealed by a successful AI generation.
  showStep3Manually(event) {
    event.preventDefault()
    this.step3Target.style.display = "block"
    this.step3Target.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  // CodeMirror's auto-init attaches each editor to its textarea, possibly after
  // this controller connects, so look editors up when they are used.
  get numberOfResultsEditor() { return this.editorFor("numberOfResultsMapper") }
  get docsEditor() { return this.editorFor("docsMapper") }
  get customHeadersEditor() { return this.editorFor("customHeaders") }

  editorFor(target) {
    const has = this[`has${target[0].toUpperCase()}${target.slice(1)}Target`]
    return has ? this[`${target}Target`].editor || null : null
  }

  // Show the ERB-rendered hint for the chosen HTTP method and use its placeholder
  updateTestQueryHint() {
    if (!this.hasHttpMethodTarget) return

    const method = this.httpMethodTarget.value === "POST" ? "POST" : "GET"

    this.testQueryHintTargets.forEach((hint) => {
      const active = hint.dataset.httpMethod === method
      hint.hidden = !active
      if (active && this.hasTestQueryTarget) this.testQueryTarget.placeholder = hint.dataset.placeholder
    })
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
    const testQuery = this.hasTestQueryTarget ? this.testQueryTarget.value.trim() : ''
    const customHeaders = this.hasCustomHeadersTarget 
      ? (this.customHeadersEditor ? this.customHeadersEditor.getValue().trim() : this.customHeadersTarget.value.trim())
      : ''
    const basicAuthCredential = this.hasBasicAuthCredentialTarget ? this.basicAuthCredentialTarget.value.trim() : ''

    // Validate custom headers JSON if provided
    if (customHeaders) {
      try {
        JSON.parse(customHeaders)
      } catch (e) {
        this.showStatus("Custom headers must be valid JSON", "error")
        return
      }
    }

    // Validate test query is valid JSON for POST requests
    if (httpMethod === 'POST' && testQuery) {
      try {
        JSON.parse(testQuery)
      } catch (e) {
        this.showStatus("Test query must be valid JSON for POST requests", "error")
        return
      }
    }

    this.setButtonLoading(this.fetchButtonTarget, true)
    this.showStatus(`Fetching via ${httpMethod}...`, "info")

    try {
      const data = await this.postWizardJson(this.fetchUrlValue, {
        search_url: url,
        http_method: httpMethod,
        test_query: testQuery,
        custom_headers: customHeaders,
        basic_auth_credential: basicAuthCredential
      })

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

  // The wizard endpoints answer validation failures with a 422 and a
  // `{ success: false, error|errors }` body that the callers render. Hand those
  // bodies back; anything else (HTML error page, expired CSRF token, network
  // failure) stays an error with a readable message.
  async postWizardJson(url, body) {
    try {
      return await postJson(url, body)
    } catch (error) {
      if (error instanceof HttpError && error.data && typeof error.data === "object") return error.data
      throw error
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
      const data = await this.postWizardJson(this.generateUrlValue, { api_key: apiKey })

      if (data.success) {

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

    const code = editor ? editor.getValue() : textarea.value
    if (!code.trim()) {
      this.showStatus(`Please enter ${mapperType} code first`, "error")
      return
    }

    this.setButtonLoading(button, true)

    try {
      const data = await this.postWizardJson(this.testUrlValue, {
        mapper_type: mapperType,
        code: code
      })

      if (data.success) {
        const result = this.resultPre(JSON.stringify(data.result, null, 2), "text-success")
        result.style.whiteSpace = "pre-wrap"
        resultTarget.replaceChildren(result)
        this.showStatus(`${mapperType} test successful!`, "success")
      } else {
        resultTarget.replaceChildren(this.resultPre(data.error, "text-danger"))
        this.showStatus(`${mapperType} test failed`, "error")
      }

      // Display console logs if any were captured
      this.displayLogs(data.logs, logsTarget, logsContainerTarget)
    } catch (error) {
      resultTarget.replaceChildren(this.resultPre(`Error: ${error.message ?? ""}`, "text-danger"))
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

    logsTarget.replaceChildren(...logs.map(log => {
      const levelClass = log.level === 'error' ? 'text-danger' :
                         log.level === 'warn' ? 'text-warning' :
                         log.level === 'info' ? 'text-info' : 'text-light'
      const levelIcon = log.level === 'error' ? '[ERROR]' :
                        log.level === 'warn' ? '[WARN]' :
                        log.level === 'info' ? '[INFO]' : '[LOG]'
      const line = document.createElement("div")
      line.className = levelClass
      line.textContent = `${levelIcon} ${log.message ?? ""}`
      return line
    }))
  }

  // A mapper test result; text is set as text, never parsed as markup
  resultPre(text, colorClass) {
    const pre = document.createElement("pre")
    pre.className = `${colorClass} mb-0`
    pre.textContent = String(text ?? "")
    return pre
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

    const currentCode = editor ? editor.getValue() : textarea.value

    this.setButtonLoading(button, true)
    this.showStatus(`Refining ${mapperType} with AI...`, "info")

    try {
      const data = await this.postWizardJson(this.refineUrlValue, {
        mapper_type: mapperType,
        current_code: currentCode,
        feedback: feedback,
        api_key: apiKey
      })

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
    const testQuery = this.hasTestQueryTarget ? this.testQueryTarget.value.trim() : ''
    const customHeaders = this.hasCustomHeadersTarget 
      ? (this.customHeadersEditor ? this.customHeadersEditor.getValue().trim() : this.customHeadersTarget.value.trim())
      : ''
    const basicAuthCredential = this.hasBasicAuthCredentialTarget ? this.basicAuthCredentialTarget.value.trim() : ''

    // Collect checked team IDs
    const teamIds = this.hasTeamCheckboxTarget
      ? this.teamCheckboxTargets.filter(cb => cb.checked).map(cb => parseInt(cb.value))
      : []

    try {
      const data = await this.postWizardJson(this.saveUrlValue, {
        name: name,
        number_of_results_mapper: numberOfResultsMapper,
        docs_mapper: docsMapper,
        endpoint_url: this.searchUrlTarget.value.trim(),
        api_method: httpMethod,
        proxy_requests: this.proxyRequestsTarget.checked,
        test_query: testQuery,
        custom_headers: customHeaders,
        basic_auth_credential: basicAuthCredential,
        team_ids: teamIds
      })

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
    if (this.hasHtmlPreviewTarget) {
      const isExpanded = this.htmlPreviewTarget.classList.toggle("expanded")
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
    if (!this.hasStatusTarget) return

    this.statusTarget.style.display = "block"
    showStatusMessage(this.statusTarget, {
      message,
      className: `alert alert-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'info'}`,
      // Auto-hide success messages after 5 seconds
      autoHideMs: type === 'success' ? 5000 : undefined,
      onExpire: (el) => { el.style.display = "none" }
    })
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
}
