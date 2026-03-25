import { Controller } from "@hotwired/stimulus"
import { apiUrl, csrfToken } from "modules/api_url"
import { fromTextArea } from "modules/editor"
import { showFlash } from "modules/flash_helper"

// Magic variables that should not appear as tuning knobs
const MAGIC_VAR_PATTERNS = [/^\$query$/, /^\$keyword\d+$/]

export default class extends Controller {
  static targets = [
    "tab",
    "tabContent",
    "queryParamsInput",
    "fieldSpecInput",
    "numberOfRowsInput",
    "escapeQueryInput",
    "warning",
    "submitButton",
    "submitArea",
    "tryHistory",
    "tryItem",
    "tryName",
    "curatorVarsContainer",
    "curatorVarsHelp",
    "annotationMessage",
    "annotationsList",
    "endpointSelect",
    "endpointInfo",
    "endpointWarning",
    "validationWarnings",
    "nightlyCheckbox",
    "runBackgroundButton",
  ]
  static values = {
    caseId: { type: Number },
    tryNumber: { type: Number },
    tryId: { type: Number },
    searchEngine: { type: String, default: "solr" },
    queryParams: { type: String, default: "" },
    fieldSpec: { type: String, default: "" },
    numberOfRows: { type: Number, default: 10 },
    escapeQuery: { type: Boolean, default: true },
    searchEndpointId: { type: Number, default: 0 },
    curatorVars: { type: Object, default: {} },
    totalTries: { type: Number, default: 1 },
  }

  connect() {
    this.dirty = false
    this.cmEditor = null
    this.endpointsLoaded = false
    this.annotationsLoaded = false

    // Extract curator vars from initial query params
    this.extractCuratorVars()

    // Initialize CodeMirror JSON editor for non-Solr engines
    this._initJsonEditor()

    // Run initial validation
    this._validateQueryParams()
  }

  disconnect() {
    if (this.cmEditor) {
      this.cmEditor.view.destroy()
      this.cmEditor = null
    }
  }

  switchTab(event) {
    const selectedTab = event.currentTarget.dataset.tab

    this.tabTargets.forEach((tab) => {
      tab.classList.toggle("tabBoxSelected", tab.dataset.tab === selectedTab)
    })

    this.tabContentTargets.forEach((content) => {
      content.classList.toggle("d-none", content.dataset.tab !== selectedTab)
    })

    // Show submit button only on actionable tabs
    const actionableTabs = ["query", "settings", "tuning"]
    if (this.hasSubmitAreaTarget) {
      this.submitAreaTarget.classList.toggle("d-none", !actionableTabs.includes(selectedTab))
    }

    // Lazy-load data for tabs
    if (selectedTab === "annotations" && !this.annotationsLoaded) {
      this._fetchAnnotations()
    }
    if (selectedTab === "settings" && !this.endpointsLoaded) {
      this._fetchEndpoints()
    }

    // Refresh CodeMirror when switching to query tab (needed for correct sizing)
    if (selectedTab === "query" && this.cmEditor) {
      this.cmEditor.view.requestMeasure()
    }
  }

  toggleSection(event) {
    const header = event.currentTarget
    const body = header.nextElementSibling
    const icon = header.querySelector(".bi")

    if (body) {
      body.classList.toggle("d-none")
    }
    if (icon) {
      icon.classList.toggle("bi-plus-lg")
      icon.classList.toggle("bi-dash-lg")
    }
  }

  markDirty() {
    this.dirty = true
    if (this.hasSubmitButtonTarget) {
      this.submitButtonTarget.textContent = "Rerun My Searches!"
    }
    this._validateQueryParams()
  }

  // ── Slice 1: Curator Variables ──────────────────────────────────

  extractCuratorVars() {
    const queryParams = this._getCurrentQueryParams()
    const varNames = this._extractVarNames(queryParams)

    if (this.hasCuratorVarsHelpTarget) {
      this.curatorVarsHelpTarget.classList.toggle("d-none", varNames.length > 0)
    }

    if (!this.hasCuratorVarsContainerTarget) return

    const container = this.curatorVarsContainerTarget
    const existingValues = this._readCuratorVarInputs()

    // Merge with server-side initial values
    const mergedValues = { ...this.curatorVarsValue, ...existingValues }

    container.innerHTML = ""

    if (varNames.length === 0) {
      container.innerHTML = '<p class="text-muted">No curator variables found in query params.</p>'
      return
    }

    varNames.forEach((name) => {
      const div = document.createElement("div")
      div.className = "curator-var-input mb-2"
      const currentValue = mergedValues[name] !== undefined ? String(mergedValues[name]) : ""
      div.innerHTML = `
        <label class="form-label">${this._escapeHtml(name)}</label>
        <input type="number" class="form-control form-control-sm"
               data-curator-var="${this._escapeHtml(name)}"
               value="${this._escapeHtml(currentValue)}"
               step="any" />
      `
      const input = div.querySelector("input")
      input.addEventListener("input", () => this.markDirty())
      container.appendChild(div)
    })
  }

  _extractVarNames(queryParams) {
    if (!queryParams) return []

    const paramsRe = /##([^#]+?)##/g
    const names = new Set()
    let match

    while ((match = paramsRe.exec(queryParams)) !== null) {
      const name = match[1]
      if (!MAGIC_VAR_PATTERNS.some((p) => p.test(name))) {
        names.add(name)
      }
    }

    return Array.from(names)
  }

  _readCuratorVarInputs() {
    const vars = {}
    if (!this.hasCuratorVarsContainerTarget) return vars

    this.curatorVarsContainerTarget.querySelectorAll("[data-curator-var]").forEach((input) => {
      const name = input.dataset.curatorVar
      if (input.value !== "") {
        vars[name] = parseFloat(input.value)
      }
    })
    return vars
  }

  // ── Slice 2: Annotations ────────────────────────────────────────

  async _fetchAnnotations() {
    this.annotationsLoaded = true
    if (!this.hasAnnotationsListTarget) return

    try {
      const response = await fetch(apiUrl(`api/cases/${this.caseIdValue}/annotations`), {
        headers: { Accept: "application/json" },
      })

      if (!response.ok) throw new Error(`Failed to fetch annotations (${response.status})`)

      const data = await response.json()
      this._renderAnnotations(data.annotations || [])
    } catch (error) {
      console.error("Failed to fetch annotations:", error)
      this.annotationsListTarget.innerHTML = '<p class="text-danger">Failed to load annotations.</p>'
    }
  }

  _renderAnnotations(annotations) {
    if (!this.hasAnnotationsListTarget) return

    if (annotations.length === 0) {
      this.annotationsListTarget.innerHTML = '<p class="text-muted">No annotations yet.</p>'
      return
    }

    const html = annotations
      .map(
        (a) => `
      <div class="annotation-item" data-annotation-id="${a.id}">
        <div class="annotation-header">
          <strong>${this._escapeHtml(a.user?.name || "Unknown")}</strong>
          <small class="text-muted">${new Date(a.created_at).toLocaleString()}</small>
          <button type="button" class="btn btn-sm btn-link text-danger annotation-delete"
                  data-action="click->settings-panel#deleteAnnotation"
                  data-annotation-id="${a.id}"
                  title="Delete">
            &times;
          </button>
        </div>
        <p class="annotation-message">${this._escapeHtml(a.message || "")}</p>
        <small class="text-muted">
          Score: ${a.score?.score != null ? a.score.score : "N/A"}
          | Try #${a.score?.try_number || "?"}
        </small>
      </div>
    `
      )
      .join("")

    this.annotationsListTarget.innerHTML = html
  }

  async createAnnotation() {
    if (!this.hasAnnotationMessageTarget) return

    const message = this.annotationMessageTarget.value.trim()
    if (!message) {
      alert("Please enter a message for the annotation.")
      return
    }

    // Get current score data from the page (set by case-score controller)
    const scoreData = this._getCurrentScoreData()

    const payload = {
      annotation: { message, source: "web_ui" },
      score: {
        all_rated: scoreData.allRated || false,
        score: scoreData.score || 0,
        try_id: this.tryIdValue,
        queries: scoreData.queries || {},
      },
    }

    try {
      const response = await fetch(apiUrl(`api/cases/${this.caseIdValue}/annotations`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken(),
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) throw new Error(`Failed to create annotation (${response.status})`)

      this.annotationMessageTarget.value = ""
      // Re-fetch to show the new annotation
      this.annotationsLoaded = false
      this._fetchAnnotations()
    } catch (error) {
      console.error("Failed to create annotation:", error)
      alert("Failed to create annotation: " + error.message)
    }
  }

  async deleteAnnotation(event) {
    const annotationId = event.currentTarget.dataset.annotationId
    if (!confirm("Delete this annotation?")) return

    try {
      const response = await fetch(apiUrl(`api/cases/${this.caseIdValue}/annotations/${annotationId}`), {
        method: "DELETE",
        headers: {
          "X-CSRF-Token": csrfToken(),
        },
      })

      if (!response.ok) throw new Error(`Failed to delete annotation (${response.status})`)

      // Remove from DOM
      const item = event.currentTarget.closest(".annotation-item")
      if (item) item.remove()
    } catch (error) {
      console.error("Failed to delete annotation:", error)
      alert("Failed to delete annotation: " + error.message)
    }
  }

  // ── Slice 7: Nightly Evaluation ──────────────────────────────────

  async toggleNightly() {
    if (!this.hasNightlyCheckboxTarget) return

    const nightly = this.nightlyCheckboxTarget.checked

    try {
      const response = await fetch(apiUrl(`api/cases/${this.caseIdValue}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken(),
          Accept: "application/json",
        },
        body: JSON.stringify({ nightly }),
      })

      if (!response.ok) throw new Error(`Failed to update nightly setting (${response.status})`)
    } catch (error) {
      console.error("Failed to toggle nightly:", error)
      // Revert checkbox on failure
      this.nightlyCheckboxTarget.checked = !nightly
      showFlash("Failed to update nightly setting: " + error.message, "danger")
    }
  }

  async runInBackground() {
    if (!this.hasRunBackgroundButtonTarget) return

    const btn = this.runBackgroundButtonTarget
    btn.disabled = true
    btn.textContent = "Queuing evaluation job..."

    try {
      const response = await fetch(apiUrl(`api/cases/${this.caseIdValue}/run_evaluation?try_number=${this.tryNumberValue}`), {
        method: "POST",
        headers: {
          "X-CSRF-Token": csrfToken(),
          Accept: "application/json",
        },
      })

      if (!response.ok) throw new Error(`Failed to queue evaluation (${response.status})`)

      showFlash("Evaluation job queued. Results will appear as a snapshot when complete.", "success")
    } catch (error) {
      console.error("Failed to run evaluation:", error)
      showFlash("Failed to queue evaluation: " + error.message, "danger")
    } finally {
      btn.textContent = "Rerun My Searches Now in the Background!"
      btn.disabled = false
    }
  }

  _getCurrentScoreData() {
    // Read the full score payload from case-score controller's data attributes,
    // which are set in case_score_controller.updateScore()
    const caseScoreEl = document.querySelector("[data-controller~='case-score']")

    if (caseScoreEl && caseScoreEl.dataset.lastScore !== undefined && caseScoreEl.dataset.lastScore !== "") {
      const score = parseFloat(caseScoreEl.dataset.lastScore)
      const allRated = caseScoreEl.dataset.lastAllRated === "true"
      let queries
      try {
        queries = JSON.parse(caseScoreEl.dataset.lastQueryScores || "{}")
      } catch {
        queries = {}
      }

      return {
        score: isNaN(score) ? 0 : score,
        allRated,
        queries,
      }
    }

    // Fallback: read score from badge text if data attributes not yet set
    const badge = document.querySelector("[data-case-score-target='badge']")
    const scoreText = badge?.textContent?.trim()
    const score = scoreText && scoreText !== "--" ? parseFloat(scoreText) : 0

    return {
      score: isNaN(score) ? 0 : score,
      allRated: false,
      queries: {},
    }
  }

  // ── Slice 3: Try Management ─────────────────────────────────────

  toggleTryActions(event) {
    event.preventDefault()
    event.stopPropagation()

    const item = event.currentTarget.closest(".try-history-item")
    const actions = item.querySelector(".try-actions")
    const details = item.querySelector(".try-details")

    if (actions) actions.classList.toggle("d-none")
    if (details) details.classList.toggle("d-none")
  }

  async renameTry(event) {
    event.stopPropagation()
    const tryNumber = event.currentTarget.dataset.tryNumber
    const item = event.currentTarget.closest(".try-history-item")
    const nameSpan = item.querySelector(".try-name")

    const currentName = nameSpan?.textContent?.trim() || ""
    const newName = prompt("Enter new name for try:", currentName)

    if (newName === null || newName === currentName) return

    try {
      const response = await fetch(apiUrl(`api/cases/${this.caseIdValue}/tries/${tryNumber}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken(),
          Accept: "application/json",
        },
        body: JSON.stringify({ try: { name: newName } }),
      })

      if (!response.ok) throw new Error(`Failed to rename try (${response.status})`)

      if (nameSpan) nameSpan.textContent = newName
    } catch (error) {
      console.error("Failed to rename try:", error)
      alert("Failed to rename try: " + error.message)
    }
  }

  async duplicateTry(event) {
    event.stopPropagation()
    const tryNumber = event.currentTarget.dataset.tryNumber

    try {
      const response = await fetch(apiUrl(`api/clone/cases/${this.caseIdValue}/tries/${tryNumber}`), {
        method: "POST",
        headers: {
          "X-CSRF-Token": csrfToken(),
          Accept: "application/json",
        },
      })

      if (!response.ok) throw new Error(`Failed to duplicate try (${response.status})`)

      const data = await response.json()
      window.location.href = this._buildTryUrl(data.try_number)
    } catch (error) {
      console.error("Failed to duplicate try:", error)
      alert("Failed to duplicate try: " + error.message)
    }
  }

  async deleteTry(event) {
    event.stopPropagation()
    const tryNumber = parseInt(event.currentTarget.dataset.tryNumber, 10)

    // Count non-deleted tries in the DOM
    const remainingTries = this.tryItemTargets.length
    if (remainingTries <= 1) {
      alert("Cannot delete the last try.")
      return
    }

    if (!confirm(`Delete try #${tryNumber}?`)) return

    try {
      const response = await fetch(apiUrl(`api/cases/${this.caseIdValue}/tries/${tryNumber}`), {
        method: "DELETE",
        headers: {
          "X-CSRF-Token": csrfToken(),
        },
      })

      if (!response.ok) throw new Error(`Failed to delete try (${response.status})`)

      // Remove from DOM
      const item = event.currentTarget.closest(".try-history-item")
      if (item) item.remove()

      // If we deleted the current try, navigate to the first remaining try
      if (tryNumber === this.tryNumberValue) {
        const firstRemaining = this.tryItemTargets[0]
        if (firstRemaining) {
          const nextTryNumber = firstRemaining.dataset.tryNumber
          window.location.href = this._buildTryUrl(nextTryNumber)
        }
      }
    } catch (error) {
      console.error("Failed to delete try:", error)
      alert("Failed to delete try: " + error.message)
    }
  }

  // ── Slice 4: Search Endpoint Picker ─────────────────────────────

  async _fetchEndpoints() {
    this.endpointsLoaded = true
    if (!this.hasEndpointSelectTarget) return

    try {
      // Fetch endpoints available for this case
      const [caseResponse, allResponse] = await Promise.all([
        fetch(apiUrl(`api/cases/${this.caseIdValue}/search_endpoints`), {
          headers: { Accept: "application/json" },
        }),
        fetch(apiUrl("api/search_endpoints"), {
          headers: { Accept: "application/json" },
        }),
      ])

      const caseData = caseResponse.ok ? await caseResponse.json() : {}
      const allData = allResponse.ok ? await allResponse.json() : {}

      // API wraps results in { search_endpoints: [...] }
      this._renderEndpointOptions(
        caseData.search_endpoints || [],
        allData.search_endpoints || []
      )
    } catch (error) {
      console.error("Failed to fetch endpoints:", error)
    }
  }

  _renderEndpointOptions(caseEndpoints, allEndpoints) {
    if (!this.hasEndpointSelectTarget) return

    const select = this.endpointSelectTarget
    const currentId = this.searchEndpointIdValue

    // Merge and deduplicate — API uses search_endpoint_id, not id
    const endpointMap = new Map()
    const addEndpoints = (list) => {
      ;(Array.isArray(list) ? list : []).forEach((ep) => {
        const epId = ep.search_endpoint_id || ep.id
        if (epId && !endpointMap.has(epId)) {
          endpointMap.set(epId, ep)
        }
      })
    }
    addEndpoints(caseEndpoints)
    addEndpoints(allEndpoints)

    select.innerHTML = '<option value="">-- Select endpoint --</option>'

    endpointMap.forEach((ep, epId) => {
      const option = document.createElement("option")
      option.value = epId
      option.textContent = ep.name || `Endpoint #${epId}`
      if (epId === currentId) option.selected = true
      if (ep.archived) option.textContent += " (archived)"
      select.appendChild(option)
    })
  }

  selectEndpoint() {
    if (!this.hasEndpointSelectTarget) return

    const selectedId = parseInt(this.endpointSelectTarget.value, 10)
    this.searchEndpointIdValue = selectedId || 0
    this.markDirty()

    // Show archived warning
    const selectedOption = this.endpointSelectTarget.selectedOptions[0]
    if (this.hasEndpointWarningTarget) {
      if (selectedOption && selectedOption.textContent.includes("(archived)")) {
        this.endpointWarningTarget.textContent = "This endpoint is archived and may not work as expected."
        this.endpointWarningTarget.classList.remove("d-none")
      } else {
        this.endpointWarningTarget.classList.add("d-none")
      }
    }
  }

  // ── Slice 5: CodeMirror JSON Editor ──────────────────────────────

  _initJsonEditor() {
    const engine = this.searchEngineValue
    if (engine === "solr" || engine === "static") return
    if (!this.hasQueryParamsInputTarget) return

    try {
      // fromTextArea hides the textarea, inserts a CodeMirror wrapper, and returns an editor API
      this.cmEditor = fromTextArea(this.queryParamsInputTarget, {
        mode: "json",
        height: "300px",
        onChange: (value) => {
          // Sync value to the hidden textarea for form reads
          this.queryParamsInputTarget.value = value
          this.markDirty()
          this.extractCuratorVars()
        },
      })
    } catch (error) {
      // CodeMirror init failed — fall back to textarea (already visible)
      console.warn("CodeMirror editor init failed, falling back to textarea:", error)
    }
  }

  // ── Slice 6: Query Param Validation ─────────────────────────────

  _validateQueryParams() {
    if (!this.hasValidationWarningsTarget) return

    const queryParams = this._getCurrentQueryParams()
    const engine = this.searchEngineValue
    const warnings = []

    if (engine === "solr") {
      // Check for common deftype typo
      if (/deftype\s*=/.test(queryParams) && !/defType\s*=/.test(queryParams)) {
        warnings.push('Did you mean <code>defType</code> (capital T)? Solr uses <code>defType</code>, not <code>deftype</code>.')
      }
    }

    if (engine === "es" || engine === "os") {
      // Warn about template queries
      if (/"template"/.test(queryParams)) {
        warnings.push("Template queries require the Search Template API endpoint (/_search/template).")
      }
      // Warn about _source field filter
      if (/"_source"/.test(queryParams)) {
        warnings.push('Using <code>_source</code> in the query body? Consider using the Displayed Fields setting instead.')
      }
    }

    // TLS mismatch warning
    if (this.hasEndpointSelectTarget) {
      const pageProtocol = window.location.protocol
      const endpointInfo = this.hasEndpointInfoTarget ? this.endpointInfoTarget.textContent : ""
      if (pageProtocol === "https:" && endpointInfo.includes("http://")) {
        warnings.push("Your page is served over HTTPS but the search endpoint uses HTTP. This may cause mixed-content blocking.")
      }
    }

    this.validationWarningsTarget.innerHTML = warnings
      .map((w) => `<div class="alert alert-info alert-sm py-1 px-2 mb-1"><small>${w}</small></div>`)
      .join("")
  }

  // ── Submit ──────────────────────────────────────────────────────

  async submit() {
    const queryParams = this._getCurrentQueryParams()
    const fieldSpec = this.hasFieldSpecInputTarget
      ? this.fieldSpecInputTarget.value
      : this.fieldSpecValue
    const numberOfRows = this.hasNumberOfRowsInputTarget
      ? parseInt(this.numberOfRowsInputTarget.value, 10)
      : this.numberOfRowsValue
    const escapeQuery = this.hasEscapeQueryInputTarget
      ? this.escapeQueryInputTarget.checked
      : this.escapeQueryValue

    // Validate JSON for ES/OS engines
    const engine = this.searchEngineValue
    if (engine !== "solr" && engine !== "static") {
      try {
        JSON.parse(queryParams)
      } catch {
        if (this.hasWarningTarget) {
          this.warningTarget.textContent =
            "Query params must be valid JSON for " + engine.toUpperCase()
          this.warningTarget.classList.remove("d-none")
        }
        return
      }
    }

    // Hide any previous warning
    if (this.hasWarningTarget) {
      this.warningTarget.classList.add("d-none")
    }

    // Disable button while submitting
    if (this.hasSubmitButtonTarget) {
      this.submitButtonTarget.disabled = true
      this.submitButtonTarget.textContent = "Creating try..."
    }

    // Collect curator variables
    const curatorVars = this._readCuratorVarInputs()

    const payload = {
      try: {
        query_params: queryParams,
        field_spec: fieldSpec,
        number_of_rows: numberOfRows,
        escape_query: escapeQuery,
        search_endpoint_id: this.searchEndpointIdValue || undefined,
      },
      parent_try_number: this.tryNumberValue,
      curator_vars: Object.keys(curatorVars).length > 0 ? curatorVars : undefined,
    }

    try {
      const response = await fetch(apiUrl(`api/cases/${this.caseIdValue}/tries`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken(),
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`Failed to create try (${response.status})`)
      }

      const data = await response.json()
      const newTryNumber = data.try_number

      // Navigate to the new try URL — page reload picks up new config
      const newUrl = this._buildTryUrl(newTryNumber)
      window.location.href = newUrl
    } catch (error) {
      console.error("Failed to create try:", error)
      alert("Failed to save settings: " + error.message)
      if (this.hasSubmitButtonTarget) {
        this.submitButtonTarget.disabled = false
        this.submitButtonTarget.textContent = "Rerun My Searches!"
      }
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────

  _getCurrentQueryParams() {
    if (this.cmEditor) {
      return this.cmEditor.getValue()
    }
    return this.hasQueryParamsInputTarget
      ? this.queryParamsInputTarget.value
      : this.queryParamsValue
  }

  _buildTryUrl(tryNumber) {
    const root = document.body.dataset.quepidRootUrl || ""
    const caseId = this.caseIdValue
    const base = root ? root.replace(/\/+$/, "") : ""
    return `${base}/case/${caseId}/try/${tryNumber}`
  }

  _escapeHtml(str) {
    const div = document.createElement("div")
    div.textContent = str
    return div.innerHTML
  }
}
