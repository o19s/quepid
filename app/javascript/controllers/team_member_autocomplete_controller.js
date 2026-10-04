import { getJson } from "api/json"
import { Controller } from "@hotwired/stimulus"

/**
 * Team Member Autocomplete Controller
 * 
 * Provides intelligent user suggestions when adding members to a team.
 * Shows avatars, names, and email addresses in a dropdown as the user types.
 * Note: Does not include keyboard navigation support.
 * 
 * Connects to data-controller="team-member-autocomplete"
 * 
 * Targets:
 *   - input: The email input field
 *   - suggestions: The dropdown container for suggestions
 * 
 * Values:
 *   - url: API endpoint for fetching suggestions
 *   - minLength: Minimum characters before showing suggestions (default: 2)
 *   - debounceDelay: Delay in ms before making API request (default: 300)
 */
export default class extends Controller {
  static targets = ["input", "suggestions", "spinner"]
  static values = {
    url: String,
    minLength: { type: Number, default: 2 },
    debounceDelay: { type: Number, default: 300 }
  }

  connect() {
    this.debounceTimer = null
    this.request = null
    this.suggestions = []
    this.isLoading = false
  }

  disconnect() {
    this.clearDebounce()
    this.abortRequest()
  }

  /**
   * Handle input changes
   * Debounces the search to avoid excessive API calls
   */
  search(event) {
    this.clearDebounce()
    this.abortRequest()
    const query = this.inputTarget.value.trim()

    if (query.length < this.minLengthValue) {
      this.hideLoading()
      this.hideSuggestions()
      return
    }

    this.debounceTimer = setTimeout(() => {
      this.showLoading()
      this.fetchSuggestions(query)
    }, this.debounceDelayValue)
  }

  /**
   * Fetch suggestions from the server. Each request supersedes the previous
   * one, so a slow response for an older query never replaces newer state.
   * @param {string} query - The search query
   */
  async fetchSuggestions(query) {
    this.abortRequest()
    const request = new AbortController()
    this.request = request
    try {
      const data = await getJson(`${this.urlValue}?query=${encodeURIComponent(query)}`, {
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        signal: request.signal
      })
      if (this.request !== request) return
      this.request = null
      this.suggestions = data
      this.hideLoading()
      this.showSuggestions(data)
    } catch (error) {
      if (this.request !== request) return
      this.request = null
      console.error('Error fetching suggestions:', error)
      this.hideLoading()
      this.hideSuggestions()
    }
  }

  /**
   * Abort the in-flight request, if any. Its response is then ignored.
   */
  abortRequest() {
    if (this.request) {
      const request = this.request
      this.request = null
      request.abort()
    }
  }

  /**
   * Display suggestions in the dropdown
   * @param {Array} users - Array of user objects with email, name, display_name, avatar_url
   */
  showSuggestions(users) {
    if (!users || users.length === 0) {
      this.hideSuggestions()
      return
    }

    this.suggestionsTarget.innerHTML = ''

    users.forEach((user) => {
      const item = this.createSuggestionItem(user)
      this.suggestionsTarget.appendChild(item)
    })

    this.suggestionsTarget.style.display = 'block'
  }

  /**
   * Create a suggestion item element
   * @param {Object} user - User object
   * @returns {HTMLElement} The suggestion item element
   */
  createSuggestionItem(user) {
    const item = document.createElement('div')
    item.className = 'autocomplete-item'
    item.dataset.email = user.email
    item.dataset.action = 'click->team-member-autocomplete#select'

    const avatar = document.createElement('img')
    avatar.src = user.avatar_url
    avatar.alt = user.display_name
    avatar.className = 'autocomplete-avatar'

    const details = document.createElement('div')
    details.className = 'autocomplete-details'

    const name = document.createElement('div')
    name.className = 'autocomplete-name'
    name.textContent = user.display_name

    details.appendChild(name)

    // Only show email if the match was on email, not on name
    if (user.matched_on === 'email') {
      const email = document.createElement('div')
      email.className = 'autocomplete-email'
      email.textContent = user.email
      details.appendChild(email)
    }

    item.appendChild(avatar)
    item.appendChild(details)

    return item
  }

  /**
   * Handle item selection via click
   */
  select(event) {
    const item = event.currentTarget
    this.selectItem(item)
  }

  selectItem(item) {
    const email = item.dataset.email
    this.inputTarget.value = email
    this.hideSuggestions()
  }

  /**
   * Hide the suggestions dropdown and clear state
   */
  hideSuggestions() {
    this.suggestionsTarget.style.display = 'none'
    this.suggestionsTarget.innerHTML = ''
    this.suggestions = []
  }

  /**
   * Clear the debounce timer
   */
  clearDebounce() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
  }

  /**
   * Handle click outside to close the dropdown
   */
  clickOutside(event) {
    if (!this.element.contains(event.target)) {
      this.hideSuggestions()
    }
  }

  /**
   * Show loading spinner
   */
  showLoading() {
    if (this.hasSpinnerTarget) {
      this.isLoading = true
      this.spinnerTarget.style.display = 'inline-block'
    }
  }

  /**
   * Hide loading spinner
   */
  hideLoading() {
    if (this.hasSpinnerTarget) {
      this.isLoading = false
      this.spinnerTarget.style.display = 'none'
    }
  }
}
