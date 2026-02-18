import { Controller } from "@hotwired/stimulus"
import TOUR_STEPS from "modules/tour_steps"

// Guided tour for the workspace using Bootstrap popovers.
// 9-step tour covering the full workspace layout, matching the Angular/Shepherd.js
// tour structure. Features: highlight overlay, back/next navigation, step counter.
// Triggered via ?startTour=true URL param (set by wizard) or manually.
export default class extends Controller {
  static values = { autoStart: Boolean }

  connect() {
    this._currentStep = -1
    this._popovers = []
    this._overlay = null

    // Check for startTour URL param (set by wizard after completion + reload)
    const url = new URL(window.location.href)
    if (url.searchParams.has("startTour")) {
      url.searchParams.delete("startTour")
      window.history.replaceState({}, "", url.toString())
      // Delay to ensure workspace is fully rendered after reload
      setTimeout(() => this.start(), 1000)
    } else if (this.autoStartValue) {
      setTimeout(() => this.start(), 1000)
    }
  }

  disconnect() {
    this._cleanup()
  }

  start() {
    this._cleanup()
    this._createOverlay()
    this._currentStep = 0
    this._showStep()
  }

  next() {
    this._hideCurrentStep()
    this._currentStep++
    if (this._currentStep < TOUR_STEPS.length) {
      this._showStep()
    } else {
      this._finish()
    }
  }

  back() {
    if (this._currentStep <= 0) return
    this._hideCurrentStep()
    this._currentStep--
    this._showStep()
  }

  skip() {
    this._cleanup()
  }

  _showStep() {
    const step = TOUR_STEPS[this._currentStep]
    if (!step) return

    const target = document.querySelector(step.target)
    if (!target) {
      // Skip missing targets
      this.next()
      return
    }

    target.scrollIntoView({ behavior: "smooth", block: "center" })
    this._highlightTarget(target)

    const Popover = window.bootstrap?.Popover
    if (!Popover) return

    const isFirst = this._currentStep === 0
    const isLast = this._currentStep === TOUR_STEPS.length - 1
    const stepLabel = `${this._currentStep + 1}/${TOUR_STEPS.length}`

    let buttons = ""
    if (isFirst) {
      buttons = `
        <button type="button" class="btn btn-outline-secondary" data-action="click->tour#skip">Skip</button>
        <button type="button" class="btn btn-primary" data-action="click->tour#next">Next</button>
      `
    } else if (isLast) {
      buttons = `
        <button type="button" class="btn btn-outline-secondary" data-action="click->tour#back">Back</button>
        <button type="button" class="btn btn-primary" data-action="click->tour#skip">Finish</button>
      `
    } else {
      buttons = `
        <button type="button" class="btn btn-outline-secondary" data-action="click->tour#back">Back</button>
        <button type="button" class="btn btn-primary" data-action="click->tour#next">Next</button>
      `
    }

    const content = `
      <p class="mb-2">${step.content}</p>
      <div class="d-flex justify-content-between align-items-center">
        <small class="text-muted">${stepLabel}</small>
        <div class="btn-group btn-group-sm">
          ${buttons}
        </div>
      </div>
    `

    const popover = new Popover(target, {
      title: step.title,
      content: content,
      html: true,
      trigger: "manual",
      placement: step.placement || "bottom",
      container: "body"
    })
    popover.show()
    this._popovers.push(popover)
  }

  _hideCurrentStep() {
    const popover = this._popovers[this._currentStep]
    if (popover) popover.dispose()
    this._clearHighlight()
  }

  _finish() {
    this._cleanup()
  }

  _createOverlay() {
    if (this._overlay) return
    this._overlay = document.createElement("div")
    this._overlay.className = "tour-overlay"
    document.body.appendChild(this._overlay)
  }

  _highlightTarget(target) {
    this._clearHighlight()
    target.classList.add("tour-highlight")
  }

  _clearHighlight() {
    const highlighted = document.querySelector(".tour-highlight")
    if (highlighted) highlighted.classList.remove("tour-highlight")
  }

  _cleanup() {
    this._popovers.forEach(p => {
      try { p.dispose() } catch (_e) { /* noop */ }
    })
    this._popovers = []
    this._currentStep = -1
    this._clearHighlight()
    if (this._overlay) {
      this._overlay.remove()
      this._overlay = null
    }
  }
}
