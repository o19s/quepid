import { Controller } from '@hotwired/stimulus';

export default class extends Controller {
  static targets = ['ratingInfo', 'loadingSpinner'];

  connect() {
    console.log('Prompt form controller connected');
  }

  /**
   * Handle form submission - show loading spinner and hide rating info
   * This is triggered by the submit action on the form
   */
  submit() {
    if (this.hasRatingInfoTarget) {
      this.ratingInfoTarget.classList.add('d-none');
    }

    if (this.hasLoadingSpinnerTarget) {
      this.loadingSpinnerTarget.classList.remove('d-none');
    }
  }

  /**
   * Reset the display state (for testing purposes)
   * Can be called with data-action="click->prompt-form#reset"
   */
  reset() {
    if (this.hasRatingInfoTarget) {
      this.ratingInfoTarget.classList.remove('d-none');
    }

    if (this.hasLoadingSpinnerTarget) {
      this.loadingSpinnerTarget.classList.add('d-none');
    }
  }
}
