import { Controller } from "@hotwired/stimulus"
import { apiFetch } from "api/fetch"
import { getQuepidRootUrl, buildApiUrl, buildCaseQueriesUrl } from "utils/quepid_root"

const TOTAL_STEPS = 4

const TMDB_DEFAULTS = {
  solr: {
    url: "http://quepid-solr.dev.o19s.com:8985/solr/tmdb/select",
    queryParams: "q=##query##&defType=edismax&qf=text_all&tie=1.0",
    fieldSpec: "id:id, title:title, overview, cast, thumb:poster_path"
  },
  es: {
    url: "http://quepid-elasticsearch.dev.o19s.com:9206/tmdb/_search",
    queryParams: '{\n  "query": {\n    "multi_match": {\n      "query": "##query##",\n      "fields": ["title^10", "overview"]\n    }\n  }\n}',
    fieldSpec: "id:_id, title:title, overview, cast, thumb:poster_path"
  },
  os: {
    url: "http://quepid-opensearch.dev.o19s.com:9000/tmdb/_search",
    queryParams: '{\n  "query": {\n    "multi_match": {\n      "query": "##query##",\n      "fields": ["title^10", "overview"]\n    }\n  }\n}',
    fieldSpec: "id:_id, title:title, overview, cast, thumb:poster_path"
  }
}

// Multi-step new case wizard. Steps: (1) Welcome, (2) Search Endpoint,
// (3) Field Spec, (4) First Query. On finish, updates the try with endpoint +
// field spec, optionally adds a query, and marks the wizard complete.
export default class extends Controller {
  static values = {
    show: Boolean,
    userId: Number,
    caseId: Number,
    tryNumber: Number,
    searchEndpoints: Array
  }

  static targets = ["modal", "modalTitle", "step", "backBtn", "nextBtn", "finishBtn", "existingEndpoint", "newEndpointFields", "searchEngine", "endpointUrl", "fieldSpec", "firstQuery", "searchapiHelp", "tmdbDemoLink", "csvFile", "csvPreview", "stepAnnouncer"]

  connect() {
    this._currentStep = 1
    this._boundHandleModalHidden = this._clearShowWizardFromUrl.bind(this)
    if (this.hasModalTarget) {
      this.modalTarget.addEventListener("hidden.bs.modal", this._boundHandleModalHidden)
    }
    if (this.showValue && this.hasModalTarget && window.bootstrap?.Modal) {
      this._modal = window.bootstrap.Modal.getOrCreateInstance(this.modalTarget) ?? new window.bootstrap.Modal(this.modalTarget)
      requestAnimationFrame(() => this._modal?.show())
    }
    this._showStep()
  }

  disconnect() {
    if (this.hasModalTarget) {
      this.modalTarget.removeEventListener("hidden.bs.modal", this._boundHandleModalHidden)
    }
  }

  next() {
    if (!this._canProceedFromCurrentStep()) return
    if (this._currentStep < TOTAL_STEPS) {
      this._currentStep++
      this._showStep()
    }
  }

  back() {
    if (this._currentStep > 1) {
      this._currentStep--
      this._showStep()
    }
  }

  onEndpointSelect() {
    if (!this.hasExistingEndpointTarget || !this.hasNewEndpointFieldsTarget) return
    const selected = this.existingEndpointTarget.value
    this.newEndpointFieldsTarget.classList.toggle("d-none", selected !== "")

    // Update field autocomplete endpoint ID
    const fieldAutoEl = this.element.querySelector("[data-controller='field-autocomplete']")
    if (fieldAutoEl) {
      fieldAutoEl.setAttribute("data-field-autocomplete-search-endpoint-id-value", selected || "0")
    }
    this._updateNavState()
  }

  onEngineChange() {
    if (!this.hasSearchapiHelpTarget || !this.hasSearchEngineTarget) return
    this.searchapiHelpTarget.classList.toggle("d-none", this.searchEngineTarget.value !== "searchapi")
    this._updateNavState()
  }

  onStepInputChange() {
    this._updateNavState()
  }

  useTmdbDemo(event) {
    event.preventDefault()
    const engine = this.hasSearchEngineTarget ? this.searchEngineTarget.value : "solr"
    const defaults = TMDB_DEFAULTS[engine]
    if (!defaults) return

    // Deselect existing endpoint so new endpoint fields are used
    if (this.hasExistingEndpointTarget) {
      this.existingEndpointTarget.value = ""
    }
    if (this.hasNewEndpointFieldsTarget) {
      this.newEndpointFieldsTarget.classList.remove("d-none")
    }

    if (this.hasEndpointUrlTarget) this.endpointUrlTarget.value = defaults.url
    if (this.hasFieldSpecTarget) this.fieldSpecTarget.value = defaults.fieldSpec

    // Store query params for use in finish()
    this._tmdbQueryParams = defaults.queryParams
    this._tmdbActive = true

    // Show feedback
    if (this.hasTmdbDemoLinkTarget) {
      this.tmdbDemoLinkTarget.replaceChildren()
      const icon = document.createElement("i")
      icon.className = "bi bi-check-circle text-success"
      icon.setAttribute("aria-hidden", "true")
      this.tmdbDemoLinkTarget.appendChild(icon)
      this.tmdbDemoLinkTarget.append(" TMDB demo settings applied!")
    }
    this._updateNavState()
  }

  async finish() {
    if (this.hasFinishBtnTarget) {
      this.finishBtnTarget.disabled = true
      this.finishBtnTarget.textContent = "Setting up…"
    }

    try {
      const root = getQuepidRootUrl()

      if (this._csvData) {
        // CSV upload flow: create static endpoint + snapshot
        await this._handleCsvUpload(root)
      } else {
        // Normal flow: endpoint + field spec
        await this._saveEndpointAndFieldSpec(root)

        // Step 4: Add queries (supports semicolon-separated, deduped)
        const queryInput = this.hasFirstQueryTarget ? this.firstQueryTarget.value.trim() : ""
        if (queryInput) {
          const queries = this._parseQueries(queryInput)
          for (const q of queries) {
            await this._addFirstQuery(root, q)
          }
        }
      }

      // Mark wizard complete for user
      await this._markWizardComplete(root)

      // Reload to show the configured workspace, with startTour flag for tour controller
      this._modal?.hide()
      const url = new URL(window.location.href)
      url.searchParams.delete("showWizard")
      url.searchParams.set("startTour", "true")
      window.location.href = url.toString()
    } catch (err) {
      console.error("Wizard finish failed:", err)
      if (window.flash) window.flash.error = err.message
      if (this.hasFinishBtnTarget) {
        this.finishBtnTarget.disabled = false
        this.finishBtnTarget.textContent = "Finish setup"
      }
    }
  }

  async _saveEndpointAndFieldSpec(root) {
    if (!this.caseIdValue || !this.tryNumberValue) return

    const url = buildApiUrl(root, "cases", this.caseIdValue, "tries", this.tryNumberValue)
    const body = { try: {} }

    // Field spec from step 3
    const fieldSpec = this.hasFieldSpecTarget ? this.fieldSpecTarget.value.trim() : ""
    if (fieldSpec) body.try.field_spec = fieldSpec

    // Query params from TMDB demo
    if (this._tmdbActive && this._tmdbQueryParams) {
      body.try.query_params = this._tmdbQueryParams
    }

    // Search endpoint from step 2
    const existingId = this.hasExistingEndpointTarget ? this.existingEndpointTarget.value : ""
    if (existingId) {
      body.try.search_endpoint_id = parseInt(existingId, 10)
    } else {
      const engine = this.hasSearchEngineTarget ? this.searchEngineTarget.value : ""
      const endpointUrl = this.hasEndpointUrlTarget ? this.endpointUrlTarget.value.trim() : ""
      if (engine && endpointUrl) {
        body.search_endpoint = {
          search_engine: engine,
          endpoint_url: endpointUrl,
          api_method: this._defaultApiMethodForEngine(engine)
        }
      }
    }

    const res = await apiFetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body)
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || data.message || `Failed to save settings (${res.status})`)
    }
  }

  _defaultApiMethodForEngine(engine) {
    const normalized = String(engine || "").toLowerCase()
    if (normalized === "es" || normalized === "os") return "POST"
    return "GET"
  }

  async _addFirstQuery(root, queryText) {
    if (!this.caseIdValue) return

    const url = buildCaseQueriesUrl(root, this.caseIdValue)
    const res = await apiFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "text/html"
      },
      body: `query_text=${encodeURIComponent(queryText)}`
    })
    if (!res.ok) {
      console.warn("Failed to add first query:", res.status)
    }
  }

  async _handleCsvUpload(root) {
    if (!this.caseIdValue || !this.tryNumberValue || !this._csvData) return

    // 1. Create a static search endpoint for the try
    const tryUrl = buildApiUrl(root, "cases", this.caseIdValue, "tries", this.tryNumberValue)
    const fieldSpec = this.hasFieldSpecTarget ? this.fieldSpecTarget.value.trim() : ""
    const tryBody = {
      try: { field_spec: fieldSpec || "id:id, title:title" },
      search_endpoint: {
        search_engine: "static",
        endpoint_url: `static://csv-upload/${this.caseIdValue}`,
        api_method: "GET"
      }
    }
    const tryRes = await apiFetch(tryUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(tryBody)
    })
    if (!tryRes.ok) throw new Error("Failed to create static endpoint")

    // 2. Add queries from CSV
    for (const queryText of Object.keys(this._csvData.queries)) {
      await this._addFirstQuery(root, queryText)
    }

    // 3. Create snapshot with the CSV data
    const snapshotUrl = buildApiUrl(root, "cases", this.caseIdValue, "snapshots")
    const snapshotDocs = {}
    const snapshotQueries = {}

    for (const [queryText, docs] of Object.entries(this._csvData.queries)) {
      const queryKey = queryText
      snapshotQueries[queryKey] = { query_text: queryText }
      snapshotDocs[queryKey] = docs.map(d => {
        const fields = { ...d }
        delete fields.id
        delete fields.position
        return { id: d.id, fields }
      })
    }

    const snapshotRes = await apiFetch(snapshotUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        snapshot: {
          name: "CSV Upload",
          docs: snapshotDocs,
          queries: snapshotQueries
        }
      })
    })
    if (!snapshotRes.ok) {
      console.warn("Snapshot creation failed:", snapshotRes.status)
    }
  }

  async _markWizardComplete(root) {
    if (!this.userIdValue) return
    const url = buildApiUrl(root, "users", this.userIdValue)
    await apiFetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ user: { completed_case_wizard: true } })
    }).catch((err) => console.warn("Failed to mark wizard complete:", err))
  }

  _showStep() {
    const steps = this.stepTargets
    steps.forEach(el => {
      const stepNum = parseInt(el.dataset.wizardStep, 10)
      const isCurrentStep = stepNum === this._currentStep
      el.classList.toggle("d-none", !isCurrentStep)
      el.setAttribute("aria-hidden", isCurrentStep ? "false" : "true")
    })

    // Update navigation buttons
    if (this.hasBackBtnTarget) {
      this.backBtnTarget.classList.toggle("d-none", this._currentStep <= 1)
    }
    if (this.hasNextBtnTarget) {
      this.nextBtnTarget.classList.toggle("d-none", this._currentStep >= TOTAL_STEPS)
    }
    if (this.hasFinishBtnTarget) {
      this.finishBtnTarget.classList.toggle("d-none", this._currentStep < TOTAL_STEPS)
    }

    // Update title
    const titles = {
      1: "Welcome to your new case",
      2: "Step 2: Search Endpoint",
      3: "Step 3: Field Display",
      4: "Step 4: First Query"
    }
    if (this.hasModalTitleTarget) {
      this.modalTitleTarget.textContent = titles[this._currentStep] || "Setup"
    }
    if (this.hasStepAnnouncerTarget) {
      this.stepAnnouncerTarget.textContent = `Wizard step ${this._currentStep} of ${TOTAL_STEPS}: ${titles[this._currentStep] || "Setup"}`
    }
    this._updateNavState()
  }

  onCsvSelected() {
    if (!this.hasCsvFileTarget || !this.csvFileTarget.files.length) return

    const file = this.csvFileTarget.files[0]
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target.result
      const result = this._parseCsv(text)
      if (result.error) {
        if (this.hasCsvPreviewTarget) {
          this.csvPreviewTarget.replaceChildren(this._buildCsvPreview("danger", result.error))
          this.csvPreviewTarget.classList.remove("d-none")
        }
        this._csvData = null
        this._updateNavState()
        return
      }

      this._csvData = result
      if (this.hasCsvPreviewTarget) {
        const queryCount = Object.keys(result.queries).length
        const docCount = Object.values(result.queries).reduce((sum, docs) => sum + docs.length, 0)
        const message = `Parsed ${queryCount} queries with ${docCount} total documents.`
        this.csvPreviewTarget.replaceChildren(this._buildCsvPreview("success", message, `Fields: ${result.fields.join(", ")}`))
        this.csvPreviewTarget.classList.remove("d-none")
      }
      this._updateNavState()
    }
    reader.readAsText(file)
  }

  _canProceedFromCurrentStep() {
    if (this._currentStep === 2) return this._stepTwoValid()
    if (this._currentStep === 3) return this._stepThreeValid()
    return true
  }

  _stepTwoValid() {
    if (this._csvData) return true
    const existingId = this.hasExistingEndpointTarget ? this.existingEndpointTarget.value : ""
    if (existingId) return true
    const endpointUrl = this.hasEndpointUrlTarget ? this.endpointUrlTarget.value.trim() : ""
    return endpointUrl.length > 0
  }

  _stepThreeValid() {
    const fieldSpec = this.hasFieldSpecTarget ? this.fieldSpecTarget.value.trim() : ""
    return fieldSpec.length > 0
  }

  _updateNavState() {
    if (!this.hasNextBtnTarget) return
    if (this._currentStep >= TOTAL_STEPS) {
      this.nextBtnTarget.disabled = true
      return
    }
    this.nextBtnTarget.disabled = !this._canProceedFromCurrentStep()
  }

  _parseCsv(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim())
    if (lines.length < 2) return { error: "CSV must have at least a header and one data row." }

    const headers = this._splitCsvLine(lines[0]).map(h => h.trim())
    const qIdx = headers.findIndex(h => h.toLowerCase() === "query text")
    const dIdx = headers.findIndex(h => h.toLowerCase() === "doc id")
    const pIdx = headers.findIndex(h => h.toLowerCase() === "doc position")

    if (qIdx < 0 || dIdx < 0 || pIdx < 0) {
      return { error: 'Missing required headers: "Query Text", "Doc ID", "Doc Position"' }
    }

    const extraFields = headers.filter((_, i) => i !== qIdx && i !== dIdx && i !== pIdx)
    const queries = {}

    for (let i = 1; i < lines.length; i++) {
      const cols = this._splitCsvLine(lines[i])
      if (cols.length <= Math.max(qIdx, dIdx, pIdx)) continue

      const queryText = cols[qIdx].trim()
      const docId = cols[dIdx].trim()
      const position = parseInt(cols[pIdx], 10)
      if (!queryText || !docId) continue

      if (!queries[queryText]) queries[queryText] = []

      const doc = { id: docId, position: isNaN(position) ? i : position }
      extraFields.forEach((field, fi) => {
        const colIdx = headers.indexOf(field)
        if (colIdx >= 0 && cols[colIdx]) {
          doc[field] = cols[colIdx].trim()
        }
      })
      queries[queryText].push(doc)
    }

    return { queries, fields: ["id", ...extraFields] }
  }

  _splitCsvLine(line) {
    const result = []
    let current = ""
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        inQuotes = !inQuotes
      } else if (ch === "," && !inQuotes) {
        result.push(current)
        current = ""
      } else {
        current += ch
      }
    }
    result.push(current)
    return result
  }

  _buildCsvPreview(type, message, details = "") {
    const alert = document.createElement("div")
    alert.className = `alert alert-${type} small py-1 px-2`
    if (type === "success") {
      const icon = document.createElement("i")
      icon.className = "bi bi-check-circle"
      icon.setAttribute("aria-hidden", "true")
      alert.appendChild(icon)
      alert.append(" ")
    }
    alert.append(message)
    if (details) {
      alert.appendChild(document.createElement("br"))
      const detailsEl = document.createElement("small")
      detailsEl.textContent = details
      alert.appendChild(detailsEl)
    }
    return alert
  }

  // Split semicolon-separated queries, trim, and deduplicate (case-insensitive)
  _parseQueries(input) {
    const seen = new Set()
    return input.split(";").map(q => q.trim()).filter(q => {
      if (!q) return false
      const key = q.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  _clearShowWizardFromUrl() {
    const url = new URL(window.location.href)
    if (url.searchParams.has("showWizard")) {
      url.searchParams.delete("showWizard")
      window.history.replaceState({}, "", url.toString())
    }
  }
}
