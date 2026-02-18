import { Controller } from "@hotwired/stimulus"
import { apiFetch } from "api/fetch"
import { getQuepidRootUrl, buildApiUrl } from "utils/quepid_root"

const TOTAL_STEPS = 4

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

  static targets = ["modal", "modalTitle", "step", "backBtn", "nextBtn", "finishBtn", "existingEndpoint", "newEndpointFields", "searchEngine", "endpointUrl", "fieldSpec", "firstQuery"]

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
  }

  disconnect() {
    if (this.hasModalTarget) {
      this.modalTarget.removeEventListener("hidden.bs.modal", this._boundHandleModalHidden)
    }
  }

  next() {
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
  }

  async finish() {
    if (this.hasFinishBtnTarget) {
      this.finishBtnTarget.disabled = true
      this.finishBtnTarget.textContent = "Setting up…"
    }

    try {
      const root = getQuepidRootUrl()

      // Step 2: Update try with search endpoint
      await this._saveEndpointAndFieldSpec(root)

      // Step 4: Add first query if provided
      const queryText = this.hasFirstQueryTarget ? this.firstQueryTarget.value.trim() : ""
      if (queryText) {
        await this._addFirstQuery(root, queryText)
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

    // Search endpoint from step 2
    const existingId = this.hasExistingEndpointTarget ? this.existingEndpointTarget.value : ""
    if (existingId) {
      body.try.search_endpoint_id = parseInt(existingId, 10)
    } else {
      const engine = this.hasSearchEngineTarget ? this.searchEngineTarget.value : ""
      const endpointUrl = this.hasEndpointUrlTarget ? this.endpointUrlTarget.value.trim() : ""
      if (engine && endpointUrl) {
        body.search_endpoint = { search_engine: engine, endpoint_url: endpointUrl }
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

  async _addFirstQuery(root, queryText) {
    if (!this.caseIdValue) return

    const url = `${root}case/${this.caseIdValue}/queries`
    const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content")
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-CSRF-Token": token || "",
        Accept: "text/html"
      },
      body: `query_text=${encodeURIComponent(queryText)}`
    })
    if (!res.ok) {
      console.warn("Failed to add first query:", res.status)
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
      el.classList.toggle("d-none", stepNum !== this._currentStep)
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
  }

  _clearShowWizardFromUrl() {
    const url = new URL(window.location.href)
    if (url.searchParams.has("showWizard")) {
      url.searchParams.delete("showWizard")
      window.history.replaceState({}, "", url.toString())
    }
  }
}
