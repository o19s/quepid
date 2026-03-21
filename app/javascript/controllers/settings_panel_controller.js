import { Controller } from "@hotwired/stimulus"
import { apiUrl, csrfToken } from "modules/api_url"

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
  ]
  static values = {
    caseId: { type: Number },
    tryNumber: { type: Number },
    searchEngine: { type: String, default: "solr" },
    queryParams: { type: String, default: "" },
    fieldSpec: { type: String, default: "" },
    numberOfRows: { type: Number, default: 10 },
    escapeQuery: { type: Boolean, default: true },
    searchEndpointId: { type: Number, default: 0 },
  }

  connect() {
    this.dirty = false
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
    const actionableTabs = ["query", "settings"]
    if (this.hasSubmitAreaTarget) {
      this.submitAreaTarget.classList.toggle("d-none", !actionableTabs.includes(selectedTab))
    }
  }

  toggleSection(event) {
    const header = event.currentTarget
    const body = header.nextElementSibling
    const icon = header.querySelector(".glyphicon")

    if (body) {
      body.classList.toggle("d-none")
    }
    if (icon) {
      icon.classList.toggle("glyphicon-plus-sign")
      icon.classList.toggle("glyphicon-minus-sign")
    }
  }

  markDirty() {
    this.dirty = true
    if (this.hasSubmitButtonTarget) {
      this.submitButtonTarget.textContent = "Rerun My Searches!"
    }
  }

  async submit() {
    const queryParams = this.hasQueryParamsInputTarget
      ? this.queryParamsInputTarget.value
      : this.queryParamsValue
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

    const payload = {
      try: {
        query_params: queryParams,
        field_spec: fieldSpec,
        number_of_rows: numberOfRows,
        escape_query: escapeQuery,
        search_endpoint_id: this.searchEndpointIdValue || undefined,
      },
      parent_try_number: this.tryNumberValue,
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

  _buildTryUrl(tryNumber) {
    const root = document.body.dataset.quepidRootUrl || ""
    const caseId = this.caseIdValue
    const base = root ? root.replace(/\/+$/, "") : ""
    return `${base}/case/${caseId}/try/${tryNumber}/new_ui`
  }
}
