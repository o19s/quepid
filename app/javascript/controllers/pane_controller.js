import { Controller } from "@hotwired/stimulus"

const DEFAULT_EAST_PANE_WIDTH = 450
// One-shot handoff so the east pane survives the full page load that saving a try or picking one
// from History triggers.
const KEEP_OPEN_KEY = "quepid.paneEast.keepOpen"

export default class extends Controller {
  static targets = ["east", "main", "slider"]

  connect() {
    this.toggled = false
    this.eastPaneWidth = DEFAULT_EAST_PANE_WIDTH
    this.dragging = false

    // Also read by the drawer's content (the tune-relevance outlet) to restore its own state.
    const kept = (this.handoff = takeKeptOpen())
    if (kept) {
      this.toggled = true
      if (kept.width > 0) this.eastPaneWidth = kept.width
    }

    this.refreshElements()
    const flashes = document.getElementById("flash-messages")
    if (flashes) {
      this.flashObserver = new ResizeObserver(() => {
        // Keep drawer actions above messages floating at the viewport bottom.
        this.element.style.setProperty("--core-flash-height", `${flashes.offsetHeight}px`)
      })
      this.flashObserver.observe(flashes)
    }
  }

  disconnect() {
    this.cancelRefreshRetry()
    this.flashObserver?.disconnect()
    this.element.style.removeProperty("--core-flash-height")
    this.releaseSlider()
  }

  refreshElements() {
    this.cancelRefreshRetry()
    this.container = this.element
    this.east = this.hasEastTarget ? this.eastTarget : null
    this.main = this.hasMainTarget ? this.mainTarget : null
    this.slider = this.hasSliderTarget ? this.sliderTarget : null

    if (!this.container || !this.east || !this.main || !this.slider) return

    // A hidden container has no width to lay out against yet; retry until it is shown.
    if (this.container.offsetWidth === 0) {
      this.refreshRetry = window.setTimeout(() => this.refreshElements(), 200)
      return
    }

    this.setupPane()
  }

  cancelRefreshRetry() {
    if (!this.refreshRetry) return
    window.clearTimeout(this.refreshRetry)
    this.refreshRetry = null
  }

  toggle() {
    this.toggled = !this.toggled
    this.setupPane()
  }

  // Called just before navigating away to another try of this case. `extras` ride along in the
  // handoff for the drawer's content.
  keepOpenAcrossNavigation(extras = {}) {
    if (!this.toggled) return
    try {
      window.sessionStorage.setItem(
        KEEP_OPEN_KEY,
        JSON.stringify({ ...extras, width: this.eastPaneWidth })
      )
    } catch {
      // Storage unavailable: the pane just starts collapsed, as before.
    }
  }

  setupPane() {
    if (!this.container || !this.east || !this.main || !this.slider) return

    if (this.toggled) {
      this.east.style.display = "block"
      this.moveEastTo(this.openEastX())
      this.slider.style.display = "block"
    } else {
      this.releaseSlider()
      this.slider.style.display = "none"
      this.east.style.display = "none"
      this.moveEastTo(this.container.offsetWidth)
    }
  }

  // The slider captures the pointer, so its own pointermove/pointerup actions keep firing while
  // the pointer is over the results, an iframe or outside the window, until the drag ends.
  grabSlider(event) {
    // A right-click opens the context menu, which can swallow the pointerup that ends the drag.
    if (!this.toggled || event.button !== 0) return
    // Keep the drag from starting a text selection.
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    this.dragging = true
  }

  dragSlider(event) {
    if (this.dragging) this.drag(event)
  }

  releaseSlider() {
    this.dragging = false
  }

  // Measured from the container, which a narrow window scrolls sideways.
  drag(event) {
    this.moveEastTo(event.clientX - this.container.getBoundingClientRect().left)
    this.eastPaneWidth = this.container.offsetWidth - parseFloat(this.main.style.width)
  }

  resize() {
    if (!this.container) return
    this.moveEastTo(this.toggled ? this.openEastX() : this.container.offsetWidth)
  }

  // A remembered width can be wider than the container (e.g. a kept-open pane on a narrower
  // window); never push the results pane to a negative width.
  openEastX() {
    return Math.max(0, this.container.offsetWidth - this.eastPaneWidth)
  }

  moveEastTo(x) {
    if (!this.container || !this.east || !this.main || !this.slider) return

    const width = this.container.offsetWidth
    if (this.toggled) {
      // Reserve the CSS minimum plus the divider so the pane fits inside
      // the container instead of being clipped by its overflow rule.
      const cssMinimumEast = parseFloat(window.getComputedStyle(this.east).minWidth) || 0
      const minimumEast = Math.min(width, Math.max(250, cssMinimumEast) + 6)
      const minimumMain = Math.min(
        width - minimumEast,
        Math.max(Math.min(230, width / 2), width - window.innerWidth)
      )
      x = Math.max(minimumMain, Math.min(x, width - minimumEast))
      this.eastPaneWidth = width - x
    }
    this.slider.style.left = `${x}px`
    this.east.style.left = `${6 + x}px`
    this.main.style.width = `${x}px`
    this.east.style.width = `${Math.max(0, this.container.offsetWidth - x - 6)}px`
  }
}

function takeKeptOpen() {
  try {
    const raw = window.sessionStorage.getItem(KEEP_OPEN_KEY)
    if (raw === null) return null
    window.sessionStorage.removeItem(KEEP_OPEN_KEY)
    return JSON.parse(raw)
  } catch {
    return null
  }
}
