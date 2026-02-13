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
    this.suggestions = []
    this.isLoading = false
  }

  disconnect() {
    this.clearDebounce()
  }

  /**
   * Handle input changes
   * Debounces the search to avoid excessive API calls
   */
  search(event) {
    this.clearDebounce()
    const query = this.inputTarget.value.trim()

    if (query.length < this.minLengthValue) {
      this.hideSuggestions()
      return
    }

    this.debounceTimer = setTimeout(() => {
      this.showLoading()
      this.fetchSuggestions(query)
    }, this.debounceDelayValue)
  }

  /**
   * Fetch suggestions from the server
   * @param {string} query - The search query
   */
  async fetchSuggestions(query) {
    try {
      const response = await fetch(`${this.urlValue}?query=${encodeURIComponent(query)}`, {
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      this.suggestions = data
      this.hideLoading()
      this.showSuggestions(data)
    } catch (error) {
      console.error('Error fetching suggestions:', error)
      this.hideLoading()
      this.hideSuggestions()
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

    const email = document.createElement('div')
    email.className = 'autocomplete-email'
    email.textContent = user.email

    details.appendChild(name)
    details.appendChild(email)

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