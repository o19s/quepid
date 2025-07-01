import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["ratingInfo", "loadingSpinner"]
  
  connect() {
    console.log("Prompt form controller connected")
  }
  
  /**
   * Handle form submission - show loading spinner and hide rating info
   * This is triggered by the submit action on the form
   */
  submit() {
    if (this.hasRatingInfoTarget) {
      this.ratingInfoTarget.style.display = "none"
    }
    
    if (this.hasLoadingSpinnerTarget) {
      this.loadingSpinnerTarget.style.display = "block"
    }
  }
  
  /**
   * Reset the display state (for testing purposes)
   * Can be called with data-action="click->prompt-form#reset"
   */
  reset() {
    if (this.hasRatingInfoTarget) {
      this.ratingInfoTarget.style.display = "block"
    }
    
    if (this.hasLoadingSpinnerTarget) {
      this.loadingSpinnerTarget.style.display = "none"
    }
  }
}