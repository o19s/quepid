import { Controller } from "@hotwired/stimulus"
import { apiFetch } from "api/fetch"
import { getQuepidRootUrl, buildApiUrl } from "utils/quepid_root"

// Field name modifiers supported in Quepid field specs
const MODIFIERS = ["media:", "thumb:", "image:", "id:", "title:"]

// Autocomplete for field spec inputs. Fetches field names from the search endpoint
// and shows a dropdown as the user types.
export default class extends Controller {
  static values = { searchEndpointId: Number }
  static targets = ["input", "dropdown"]

  connect() {
    this._fields = null
    this._cachedEndpointId = null
    this._selectedIndex = -1
    this._boundOnInput = this._onInput.bind(this)
    this._boundOnKeydown = this._onKeydown.bind(this)
    this._boundOnBlur = this._onBlur.bind(this)

    if (this.hasInputTarget) {
      this.inputTarget.addEventListener("input", this._boundOnInput)
      this.inputTarget.addEventListener("keydown", this._boundOnKeydown)
      this.inputTarget.addEventListener("blur", this._boundOnBlur)
      this.inputTarget.setAttribute("autocomplete", "off")
    }
  }

  // Stimulus callback: fires when the searchEndpointId value attribute changes
  searchEndpointIdValueChanged() {
    this._fields = null
    this._cachedEndpointId = null
  }

  disconnect() {
    if (this.hasInputTarget) {
      this.inputTarget.removeEventListener("input", this._boundOnInput)
      this.inputTarget.removeEventListener("keydown", this._boundOnKeydown)
      this.inputTarget.removeEventListener("blur", this._boundOnBlur)
    }
  }

  async _onInput() {
    if (!this.searchEndpointIdValue) return

    // Fetch fields on first input
    if (!this._fields) {
      await this._fetchFields()
      if (!this._fields) return
    }

    const segment = this._currentSegment()
    if (!segment || segment.length < 1) {
      this._hideDropdown()
      return
    }

    // Strip modifier prefix for matching
    let searchTerm = segment
    for (const mod of MODIFIERS) {
      if (searchTerm.startsWith(mod)) {
        searchTerm = searchTerm.slice(mod.length)
        break
      }
    }

    if (!searchTerm) {
      this._hideDropdown()
      return
    }

    const lower = searchTerm.toLowerCase()
    const matches = this._fields.filter(f => f.toLowerCase().includes(lower)).slice(0, 10)

    if (matches.length === 0) {
      this._hideDropdown()
      return
    }

    this._showDropdown(matches)
  }

  _onKeydown(event) {
    if (!this.hasDropdownTarget || this.dropdownTarget.classList.contains("d-none")) return

    const items = this.dropdownTarget.querySelectorAll(".dropdown-item")
    if (items.length === 0) return

    if (event.key === "ArrowDown") {
      event.preventDefault()
      this._selectedIndex = Math.min(this._selectedIndex + 1, items.length - 1)
      this._highlightItem(items)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      this._selectedIndex = Math.max(this._selectedIndex - 1, 0)
      this._highlightItem(items)
    } else if (event.key === "Enter" || event.key === "Tab") {
      if (this._selectedIndex >= 0 && this._selectedIndex < items.length) {
        event.preventDefault()
        this._selectField(items[this._selectedIndex].dataset.field)
      }
    } else if (event.key === "Escape") {
      this._hideDropdown()
    }
  }

  _onBlur() {
    // Delay to allow click on dropdown item
    setTimeout(() => this._hideDropdown(), 200)
  }

  _currentSegment() {
    if (!this.hasInputTarget) return ""
    const value = this.inputTarget.value
    const cursor = this.inputTarget.selectionStart || value.length
    const before = value.substring(0, cursor)
    const segments = before.split(",")
    return segments[segments.length - 1].trim()
  }

  _selectField(field) {
    if (!this.hasInputTarget) return

    const value = this.inputTarget.value
    const cursor = this.inputTarget.selectionStart || value.length
    const before = value.substring(0, cursor)
    const after = value.substring(cursor)

    // Find the start of the current segment
    const lastComma = before.lastIndexOf(",")
    const prefix = lastComma >= 0 ? before.substring(0, lastComma + 1) + " " : ""

    // Preserve any modifier prefix
    const segment = this._currentSegment()
    let modifier = ""
    for (const mod of MODIFIERS) {
      if (segment.startsWith(mod)) {
        modifier = mod
        break
      }
    }

    this.inputTarget.value = prefix + modifier + field + after
    this.inputTarget.focus()
    this._hideDropdown()
  }

  _showDropdown(matches) {
    if (!this.hasDropdownTarget) return
    this._selectedIndex = -1

    const html = matches.map(field => {
      const escaped = this._escapeHtml(field)
      return `<button type="button" class="dropdown-item small" data-field="${escaped}" data-action="mousedown->field-autocomplete#selectFromDropdown">${escaped}</button>`
    }).join("")

    this.dropdownTarget.innerHTML = html
    this.dropdownTarget.classList.remove("d-none")
  }

  selectFromDropdown(event) {
    event.preventDefault()
    this._selectField(event.currentTarget.dataset.field)
  }

  _hideDropdown() {
    if (this.hasDropdownTarget) {
      this.dropdownTarget.classList.add("d-none")
      this.dropdownTarget.innerHTML = ""
    }
    this._selectedIndex = -1
  }

  _highlightItem(items) {
    items.forEach((item, idx) => {
      item.classList.toggle("active", idx === this._selectedIndex)
    })
  }

  async _fetchFields() {
    try {
      const root = getQuepidRootUrl()
      const url = buildApiUrl(root, "search_endpoints", this.searchEndpointIdValue, "fields")
      const res = await apiFetch(url, { headers: { Accept: "application/json" } })
      if (!res.ok) return

      const data = await res.json()
      this._fields = data.fields || []
    } catch (err) {
      console.warn("Field autocomplete fetch failed:", err)
      this._fields = []
    }
  }

  _escapeHtml(str) {
    if (str == null) return ""
    const div = document.createElement("div")
    div.textContent = String(str)
    return div.innerHTML
  }
}
