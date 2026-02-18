import { Controller } from "@hotwired/stimulus"

// Collapsible east/west side panels for the core workspace. West = query list,
// East = results pane. Toggle state is persisted in localStorage per case.
//
// @see docs/turbo_frame_boundaries.md § Side Panels
export default class extends Controller {
  static values = { caseId: Number }

  static targets = [
    "westPanel", "eastPanel",
    "westContent", "eastContent",
    "westCollapseBtn", "westExpandBtn",
    "eastCollapseBtn", "eastExpandBtn"
  ]

  connect() {
    this._storageKey = this._storageKeyForCase()
    this._restoreState()
  }

  toggleWest() {
    this._westCollapsed = !this._westCollapsed
    this._applyState()
    this._persistState()
  }

  toggleEast() {
    this._eastCollapsed = !this._eastCollapsed
    this._applyState()
    this._persistState()
  }

  _storageKeyForCase() {
    const id = this.caseIdValue ?? 0
    return `quepid-workspace-panels-${id}`
  }

  _restoreState() {
    try {
      const raw = localStorage.getItem(this._storageKey)
      const data = raw ? JSON.parse(raw) : {}
      this._westCollapsed = !!data.westCollapsed
      this._eastCollapsed = !!data.eastCollapsed
    } catch {
      this._westCollapsed = false
      this._eastCollapsed = false
    }
    this._applyState()
  }

  _persistState() {
    try {
      localStorage.setItem(
        this._storageKey,
        JSON.stringify({
          westCollapsed: this._westCollapsed,
          eastCollapsed: this._eastCollapsed
        })
      )
    } catch (_e) {
      /* ignore */
    }
  }

  _applyState() {
    if (this.hasWestPanelTarget) {
      this.westPanelTarget.classList.toggle("workspace-panel--collapsed", this._westCollapsed)
      this.westPanelTarget.setAttribute("aria-expanded", !this._westCollapsed)
      // Clear custom flex-basis when collapsing so collapse CSS takes over
      if (this._westCollapsed) {
        this.westPanelTarget.style.flexBasis = ""
        this.westPanelTarget.style.flex = ""
      }
    }
    if (this.hasEastPanelTarget) {
      this.eastPanelTarget.classList.toggle("workspace-panel--collapsed", this._eastCollapsed)
      this.eastPanelTarget.setAttribute("aria-expanded", !this._eastCollapsed)
    }
    if (this.hasWestContentTarget) {
      this.westContentTarget.classList.toggle("d-none", this._westCollapsed)
    }
    if (this.hasEastContentTarget) {
      this.eastContentTarget.classList.toggle("d-none", this._eastCollapsed)
    }
    if (this.hasWestCollapseBtnTarget) {
      this.westCollapseBtnTarget.classList.toggle("d-none", this._westCollapsed)
    }
    if (this.hasWestExpandBtnTarget) {
      this.westExpandBtnTarget.classList.toggle("d-none", !this._westCollapsed)
    }
    if (this.hasEastCollapseBtnTarget) {
      this.eastCollapseBtnTarget.classList.toggle("d-none", this._eastCollapsed)
    }
    if (this.hasEastExpandBtnTarget) {
      this.eastExpandBtnTarget.classList.toggle("d-none", !this._eastCollapsed)
    }
  }
}
