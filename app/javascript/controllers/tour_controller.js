import { Controller } from "@hotwired/stimulus"

/**
 * Lightweight tour controller — replaces the Shepherd.js-based tour
 * with a zero-dependency Stimulus implementation.
 *
 * Trigger via:
 *   - URL param ?showWizard=true (auto-starts on connect)
 *   - data-action="click->tour#start" on a link
 */

// Step text is injected as innerHTML (not textContent) to allow <a> links.
// These are hardcoded constants — never populate from user input.
const STEPS = [
  {
    target: "#case-header",
    title: "Case Header",
    text: "This is the case header. It shows the current case name, try number, and score.",
    position: "bottom",
  },
  {
    target: ".case-score-badge",
    title: "Case Score",
    text: "This is your case score — the average score of all queries. It updates automatically as you rate results.",
    position: "right",
  },
  {
    target: "#add-query",
    title: "Add Query",
    text: 'Add more queries to your case here. Try "Toy Story" if you are using the default TMDB setup.',
    position: "right",
  },
  {
    target: "ul.results-list-element",
    title: "Queries",
    text: "Your queries appear here. Click on a query to expand it and see search results.",
    position: "top",
  },
  {
    target: "#case-actions",
    title: "Case Actions",
    text: "All case actions are available here — snapshots, comparisons, import/export, clone, and more.",
    position: "bottom",
  },
  {
    target: "#tune-relevance-link",
    title: "Tune Relevance",
    text: 'Click "Tune Relevance" to open the settings pane where you can edit query parameters, manage tries, and configure your search endpoint.',
    position: "bottom",
  },
  {
    target: ".pane_east",
    title: "Tune Relevance Pane",
    text: "This is where the magic happens! Edit query parameters, configure curator variables, manage tries and annotations. Make sure #$query## exists in your query template.",
    position: "left",
  },
  {
    target: "#query-sandbox-action",
    title: "Rerun Searches",
    text: 'Click "Rerun My Searches!" to see your changes take effect across all queries.',
    position: "top",
  },
  {
    target: "#case-header",
    title: "You're All Set!",
    text: 'That\'s how Quepid works! Explore the other tabs in "Tune Relevance" and check out the <a href="https://github.com/o19s/quepid/wiki" target="_blank" rel="noopener">Wiki</a> for more.',
    position: "bottom",
  },
]

export default class extends Controller {
  connect() {
    this._currentStep = -1
    this._overlay = null
    this._tooltip = null
    this._onKeydown = (e) => {
      if (this._currentStep < 0) return
      if (e.key === "Escape") this.exit()
    }
    document.addEventListener("keydown", this._onKeydown)

    // Auto-start if ?startTour=true (set by wizard after completion).
    // Note: ?showWizard=true opens the wizard modal first; the tour starts
    // after the wizard finishes and reloads the page with ?startTour=true.
    const params = new URLSearchParams(window.location.search)
    if (params.get("startTour") === "true" || params.get("showWizard") === "true") {
      // Don't start the tour if the wizard modal is about to open
      if (params.get("showWizard") === "true") return

      // Small delay to let the page finish rendering
      requestAnimationFrame(() => this.start())
    }
  }

  disconnect() {
    document.removeEventListener("keydown", this._onKeydown)
    this._cleanup()
  }

  start() {
    this._ensureOverlay()
    // Find the first visible step
    this._currentStep = -1
    this._advance(1)
  }

  next() {
    this._advance(1)
  }

  back() {
    this._advance(-1)
  }

  // Skip hidden/missing steps in the given direction (+1 or -1)
  _advance(direction) {
    let idx = this._currentStep + direction
    while (idx >= 0 && idx < STEPS.length) {
      if (this._isStepVisible(idx)) {
        this._currentStep = idx
        this._renderStep()
        return
      }
      idx += direction
    }
    // Ran off the end — finish tour
    if (direction > 0) this.exit()
  }

  _isStepVisible(idx) {
    const el = document.querySelector(STEPS[idx].target)
    return el && el.offsetParent !== null
  }

  exit() {
    this._cleanup()
  }

  // Private

  _ensureOverlay() {
    if (this._overlay) return

    this._overlay = document.createElement("div")
    this._overlay.className = "tour-overlay"
    this._overlay.addEventListener("click", () => this.exit())
    document.body.appendChild(this._overlay)
    document.body.classList.add("tour-active")
  }

  _renderStep() {
    const step = STEPS[this._currentStep]
    if (!step) return

    // Remove old tooltip
    if (this._tooltip) this._tooltip.remove()

    // Remove highlight from previous target
    document.querySelectorAll(".tour-highlight").forEach((el) => {
      el.classList.remove("tour-highlight")
    })

    // Highlight the target element (if visible)
    const targetEl = document.querySelector(step.target)
    if (targetEl && targetEl.offsetParent !== null) {
      targetEl.classList.add("tour-highlight")
      targetEl.scrollIntoView({ behavior: "smooth", block: "center" })
    }

    // Build tooltip
    this._tooltip = document.createElement("div")
    this._tooltip.className = "tour-tooltip"
    this._tooltip.innerHTML = `
      <div class="tour-tooltip-header">
        <strong>${this._escapeHtml(step.title)}</strong>
        <span class="tour-step-count">${this._currentStep + 1}/${STEPS.length}</span>
      </div>
      <div class="tour-tooltip-body">${step.text}</div>
      <div class="tour-tooltip-footer">
        ${this._currentStep > 0 ? '<button type="button" class="btn btn-sm btn-secondary tour-btn-back">Back</button>' : ""}
        ${this._currentStep < STEPS.length - 1 ? '<button type="button" class="btn btn-sm btn-primary tour-btn-next">Next</button>' : '<button type="button" class="btn btn-sm btn-success tour-btn-next">Finish</button>'}
        <button type="button" class="btn btn-sm btn-link tour-btn-exit">Exit tour</button>
      </div>
    `

    document.body.appendChild(this._tooltip)

    // Attach button handlers
    const backBtn = this._tooltip.querySelector(".tour-btn-back")
    if (backBtn) backBtn.addEventListener("click", () => this.back())

    const nextBtn = this._tooltip.querySelector(".tour-btn-next")
    if (nextBtn) nextBtn.addEventListener("click", () => this.next())

    const exitBtn = this._tooltip.querySelector(".tour-btn-exit")
    if (exitBtn) exitBtn.addEventListener("click", () => this.exit())

    // Position the tooltip relative to the target
    this._positionTooltip(targetEl, step.position)
  }

  _positionTooltip(targetEl, position) {
    if (!targetEl || !this._tooltip) return

    const rect = targetEl.getBoundingClientRect()
    const tooltipRect = this._tooltip.getBoundingClientRect()
    const scrollY = window.scrollY
    const scrollX = window.scrollX

    let top, left

    switch (position) {
      case "bottom":
        top = rect.bottom + scrollY + 12
        left = rect.left + scrollX + rect.width / 2 - tooltipRect.width / 2
        break
      case "top":
        top = rect.top + scrollY - tooltipRect.height - 12
        left = rect.left + scrollX + rect.width / 2 - tooltipRect.width / 2
        break
      case "left":
        top = rect.top + scrollY + rect.height / 2 - tooltipRect.height / 2
        left = rect.left + scrollX - tooltipRect.width - 12
        break
      case "right":
        top = rect.top + scrollY + rect.height / 2 - tooltipRect.height / 2
        left = rect.right + scrollX + 12
        break
      default:
        top = rect.bottom + scrollY + 12
        left = rect.left + scrollX
    }

    // Keep tooltip within viewport
    left = Math.max(8, Math.min(left, window.innerWidth - tooltipRect.width - 8))
    top = Math.max(8, top)

    this._tooltip.style.top = `${top}px`
    this._tooltip.style.left = `${left}px`
  }

  _cleanup() {
    if (this._tooltip) {
      this._tooltip.remove()
      this._tooltip = null
    }
    if (this._overlay) {
      this._overlay.remove()
      this._overlay = null
    }
    document.body.classList.remove("tour-active")
    document.querySelectorAll(".tour-highlight").forEach((el) => {
      el.classList.remove("tour-highlight")
    })
    this._currentStep = -1
  }

  _escapeHtml(str) {
    const div = document.createElement("div")
    div.textContent = str
    return div.innerHTML
  }
}
