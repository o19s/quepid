import { Controller } from '@hotwired/stimulus';
import { getQuepidRootUrl, buildPageUrl } from 'utils/quepid_root';

export default class extends Controller {
  static targets = ['rating', 'explanation', 'status', 'savedIndicator'];
  static values = { bookId: String };

  connect() {
    this.saveTimeout = null;
    this.statusHideTimers = new Map();
  }

  disconnect() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.statusHideTimers.forEach((timerId) => clearTimeout(timerId));
    this.statusHideTimers.clear();
  }

  // Called when reset button is clicked
  async resetRating(event) {
    const button = event.currentTarget;
    const queryDocPairId = button.dataset.queryDocPairId;

    // Show saving status first
    this.showStatus(queryDocPairId, 'saving');

    try {
      const response = await fetch(this._bulkJudgeUrl('delete'), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': this.getCSRFToken(),
        },
        body: JSON.stringify({
          query_doc_pair_id: queryDocPairId,
        }),
      });

      if (response.ok) {
        // Successfully deleted the judgement
        this.clearRatingUI(queryDocPairId);
        this.showStatus(queryDocPairId, 'reset');
        button.remove();
      } else if (response.status === 404) {
        // No judgement found to delete - this is actually fine for reset
        this.clearRatingUI(queryDocPairId);
        this.showStatus(queryDocPairId, 'reset');
        button.remove();
      } else {
        // Other error
        this.showStatus(queryDocPairId, 'error');
        console.error('Failed to reset judgement:', response.status);
      }
    } catch (error) {
      this.showStatus(queryDocPairId, 'error');
      console.error('Error resetting judgement:', error);
    }
  }

  // Helper method to clear rating UI elements
  clearRatingUI(queryDocPairId) {
    // Clear radio button selection
    const radios = this.element.querySelectorAll(`input[name="judgement_${queryDocPairId}"]`);
    radios.forEach((radio) => {
      radio.checked = false;
    });

    // Remove btn-preselected class from all labels for this query_doc_pair
    const labels = this.element.querySelectorAll(
      `#qdp_${queryDocPairId} .rating-buttons-container label`
    );
    labels.forEach((label) => {
      label.classList.remove('btn-preselected');
    });

    // Clear explanation field
    const explanationField = this.element.querySelector(`#explanation_${queryDocPairId}`);
    if (explanationField) {
      explanationField.value = '';
    }
  }

  // Called when a rating is clicked
  async saveRating(event) {
    const button = event.currentTarget;
    const queryDocPairId = button.dataset.queryDocPairId;
    const rating = button.dataset.rating;

    // Update UI immediately for responsiveness
    this.updateRatingButtons(queryDocPairId, rating);

    // Show or create reset button
    this.showResetButton(queryDocPairId);

    // Show saving status
    this.showStatus(queryDocPairId, 'saving');

    // Get explanation if it exists
    const explanationField = this.element.querySelector(`#explanation_${queryDocPairId}`);
    const explanation = explanationField ? explanationField.value : '';

    try {
      const response = await fetch(this._bulkJudgeUrl('save'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': this.getCSRFToken(),
        },
        body: JSON.stringify({
          query_doc_pair_id: queryDocPairId,
          rating: rating,
          explanation: explanation,
        }),
      });

      if (response.ok) {
        this.showStatus(queryDocPairId, 'saved');
      } else {
        this.showStatus(queryDocPairId, 'error');
        console.error('Failed to save judgement');
      }
    } catch (error) {
      this.showStatus(queryDocPairId, 'error');
      console.error('Error saving judgement:', error);
    }
  }

  // Called when explanation text changes
  saveExplanation(event) {
    const field = event.currentTarget;
    const queryDocPairId = field.dataset.queryDocPairId;

    // Clear existing timeout
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    // Show typing status
    this.showStatus(queryDocPairId, 'typing');

    // Debounce the save
    this.saveTimeout = setTimeout(async () => {
      // Get current rating if it exists
      const checkedRating = this.element.querySelector(
        `input[name="judgement_${queryDocPairId}"]:checked`
      );

      const rating = checkedRating ? checkedRating.value : null;
      const explanation = field.value;

      // Only save if we have either a rating or an explanation
      if (!rating && !explanation.trim()) {
        this.showStatus(queryDocPairId, '');
        return;
      }

      this.showStatus(queryDocPairId, 'saving');

      try {
        const response = await fetch(this._bulkJudgeUrl('save'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': this.getCSRFToken(),
          },
          body: JSON.stringify({
            query_doc_pair_id: queryDocPairId,
            rating: rating,
            explanation: explanation,
          }),
        });

        if (response.ok) {
          this.showStatus(queryDocPairId, 'saved');
        } else {
          this.showStatus(queryDocPairId, 'error');
        }
      } catch (error) {
        this.showStatus(queryDocPairId, 'error');
        console.error('Error saving explanation:', error);
      }
    }, 1000); // Wait 1 second after typing stops
  }

  updateRatingButtons(queryDocPairId, selectedRating) {
    // Update radio button state and handle btn-preselected class
    const radios = this.element.querySelectorAll(`input[name="judgement_${queryDocPairId}"]`);
    const labels = this.element.querySelectorAll(
      `#qdp_${queryDocPairId} .rating-buttons-container label`
    );

    // First remove btn-preselected from all labels
    labels.forEach((label) => {
      label.classList.remove('btn-preselected');
    });

    // Then update radio states and add btn-preselected to selected button
    radios.forEach((radio) => {
      if (radio.value === selectedRating) {
        radio.checked = true;
        // Find the corresponding label and add btn-preselected class
        const label = this.element.querySelector(`label[for="${radio.id}"]`);
        if (label) {
          label.classList.add('btn-preselected');
        }
      }
    });
  }

  showResetButton(queryDocPairId) {
    // Check if reset button already exists
    const existingButton = this.element.querySelector(
      `button[data-query-doc-pair-id="${queryDocPairId}"][data-action*="resetRating"]`
    );

    if (!existingButton) {
      // Create reset button dynamically
      const ratingContainer = this.element.querySelector(
        `#qdp_${queryDocPairId} .rating-buttons .d-flex`
      );
      if (ratingContainer) {
        const resetButton = document.createElement('button');
        resetButton.type = 'button';
        resetButton.className = 'btn btn-sm btn-outline-secondary ms-3';
        resetButton.setAttribute('data-action', 'click->bulk-judgement#resetRating');
        resetButton.setAttribute('data-query-doc-pair-id', queryDocPairId);
        resetButton.title = 'Clear rating';
        resetButton.innerHTML = '<i class="bi bi-x-circle"></i> Reset';
        ratingContainer.appendChild(resetButton);
      }
    }
  }

  showStatus(queryDocPairId, status) {
    const statusElement = this.element.querySelector(`#status_${queryDocPairId}`);
    if (!statusElement) return;

    // Remove all status classes
    statusElement.classList.remove('text-muted', 'text-warning', 'text-success', 'text-danger');

    switch (status) {
      case 'saving':
        statusElement.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Saving...';
        statusElement.classList.add('text-warning');
        break;
      case 'saved':
        statusElement.innerHTML = '<i class="bi bi-check-circle"></i> Saved';
        statusElement.classList.add('text-success');
        // Hide success message after 2 seconds
        this._clearStatusHideTimer(queryDocPairId);
        this.statusHideTimers.set(
          queryDocPairId,
          setTimeout(() => {
            this.statusHideTimers.delete(queryDocPairId);
            if (statusElement.innerHTML.includes('Saved')) {
              statusElement.innerHTML = '';
            }
          }, 2000)
        );
        break;
      case 'reset':
        statusElement.innerHTML = '<i class="bi bi-arrow-counterclockwise"></i> Reset';
        statusElement.classList.add('text-info');
        // Hide reset message after 2 seconds
        this._clearStatusHideTimer(queryDocPairId);
        this.statusHideTimers.set(
          queryDocPairId,
          setTimeout(() => {
            this.statusHideTimers.delete(queryDocPairId);
            if (statusElement.innerHTML.includes('Reset')) {
              statusElement.innerHTML = '';
            }
          }, 2000)
        );
        break;
      case 'error':
        statusElement.innerHTML = '<i class="bi bi-x-circle"></i> Error saving';
        statusElement.classList.add('text-danger');
        break;
      case 'typing':
        statusElement.innerHTML = '<i class="bi bi-pencil"></i> Typing...';
        statusElement.classList.add('text-muted');
        break;
      default:
        statusElement.innerHTML = '';
    }
  }

  /**
   * Builds the bulk judge API URL for the given action ('delete' or 'save').
   * Subpath-safe via getQuepidRootUrl + buildPageUrl.
   */
  _bulkJudgeUrl(action) {
    const root = getQuepidRootUrl();
    return buildPageUrl(root, 'books', this.bookIdValue, 'judge', 'bulk', action);
  }

  _clearStatusHideTimer(queryDocPairId) {
    const existing = this.statusHideTimers.get(queryDocPairId);
    if (existing) {
      clearTimeout(existing);
      this.statusHideTimers.delete(queryDocPairId);
    }
  }

  getCSRFToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content;
  }
}
