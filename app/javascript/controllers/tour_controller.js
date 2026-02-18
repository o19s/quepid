import { Controller } from "@hotwired/stimulus"
import TOUR_STEPS from "modules/tour_steps"

// Guided tour for the workspace using Bootstrap popovers.
// Listens for "wizard:completed" custom event to auto-start the tour.
// Can also be triggered manually via a "Start tour" button.
export default class extends Controller {
  static values = { autoStart: Boolean }

  connect() {
    this._currentStep = -1
    this._popovers = []

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

    const Popover = window.bootstrap?.Popover
    if (!Popover) return

    const isLast = this._currentStep === TOUR_STEPS.length - 1
    const stepLabel = `${this._currentStep + 1}/${TOUR_STEPS.length}`
    const content = `
      <p class="mb-2">${step.content}</p>
      <div class="d-flex justify-content-between align-items-center">
        <small class="text-muted">${stepLabel}</small>
        <div class="btn-group btn-group-sm">
          <button type="button" class="btn btn-outline-secondary" data-action="click->tour#skip">Skip</button>
          <button type="button" class="btn btn-primary" data-action="click->tour#next">${isLast ? "Finish" : "Next"}</button>
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
  }

  _finish() {
    this._cleanup()
  }

  _cleanup() {
    this._popovers.forEach(p => {
      try { p.dispose() } catch (_e) { /* noop */ }
    })
    this._popovers = []
    this._currentStep = -1
  }
}
