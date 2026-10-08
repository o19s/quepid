import { Controller } from "@hotwired/stimulus"
import { deleteJson, postJson } from "api/json"
import { HttpError } from "api/http_error"
import { withStatusMessages } from "controllers/status_message_behavior"

const STATUS_VARIANT_CLASSES = [
  "text-muted",
  "text-warning",
  "text-success",
  "text-danger",
  "text-info"
]

export default class extends withStatusMessages(Controller) {
  static targets = ["rating", "explanation", "status", "savedIndicator"]
  static values = { saveUrl: String, deleteUrl: String }

  connect() {
    this.saveTimeouts = new Map()
    this.savedExplanations = new Map(
      [...this.element.querySelectorAll("textarea[data-query-doc-pair-id]")].map((field) =>
        [field.dataset.queryDocPairId, field.value]
      )
    )
  }

  disconnect() {
    super.disconnect()
    this.saveTimeouts.forEach((timeout) => clearTimeout(timeout))
    this.saveTimeouts.clear()
  }

  // Called when reset button is clicked
  async resetRating(event) {
    const button = event.currentTarget
    const queryDocPairId = button.dataset.queryDocPairId
    // Show saving status first
    this.showStatus(queryDocPairId, "saving")

    try {
      await deleteJson(this.deleteUrlValue, {
        query_doc_pair_id: queryDocPairId
        })

      this.clearRatingUI(queryDocPairId)
      this.showStatus(queryDocPairId, "reset")
      button.remove()
    } catch (error) {
      // Reset is idempotent: a missing judgement is already reset.
      if (error instanceof HttpError && error.status === 404) {
        this.clearRatingUI(queryDocPairId)
        this.showStatus(queryDocPairId, "reset")
        button.remove()
        return
      }
      this.showStatus(queryDocPairId, "error")
      console.error("Error resetting judgement:", error)
    }
  }

  // Helper method to clear rating UI elements
  clearRatingUI(queryDocPairId) {
    // Clear radio button selection
    const radios = this.element.querySelectorAll(`input[name="judgement_${queryDocPairId}"]`)
    radios.forEach(radio => {
      radio.checked = false
    })

    // Remove btn-preselected class from all labels for this query_doc_pair
    const labels = this.element.querySelectorAll(`#qdp_${queryDocPairId} .rating-buttons-container label`)
    labels.forEach(label => {
      label.classList.remove('btn-preselected')
    })

    // Clear explanation field
    const explanationField = this.element.querySelector(`#explanation_${queryDocPairId}`)
    if (explanationField) {
      explanationField.value = ''
    }
    this.savedExplanations.set(queryDocPairId, "")
  }

  // Called when a rating is clicked
  async saveRating(event) {
    const button = event.currentTarget
    const queryDocPairId = button.dataset.queryDocPairId
    const rating = button.dataset.rating
    // Update UI immediately for responsiveness
    this.updateRatingButtons(queryDocPairId, rating)

    // Show or create reset button
    this.showResetButton(queryDocPairId)

    // Show saving status
    this.showStatus(queryDocPairId, "saving")

    const explanationField = this.element.querySelector(`#explanation_${queryDocPairId}`)
    const explanation = explanationField ? explanationField.value : ""

    try {
      await postJson(this.saveUrlValue, {
        query_doc_pair_id: queryDocPairId,
        rating: rating,
        explanation: explanation
        })

      this.savedExplanations.set(queryDocPairId, explanation)
      this.showStatus(queryDocPairId, "saved")
    } catch (error) {
      this.showStatus(queryDocPairId, "error")
      console.error("Error saving judgement:", error)
    }
  }

  // Called when explanation text changes
  saveExplanation(event) {
    const field = event.currentTarget
    const queryDocPairId = field.dataset.queryDocPairId
    // Debounce independently for each document row.
    clearTimeout(this.saveTimeouts.get(queryDocPairId))

    // Show typing status
    this.showStatus(queryDocPairId, "typing")

    // Debounce the save
    this.saveTimeouts.set(queryDocPairId, setTimeout(async () => {
      this.saveTimeouts.delete(queryDocPairId)
      // Get current rating if it exists
      const checkedRating = this.element.querySelector(
        `input[name="judgement_${queryDocPairId}"]:checked`
      )

      const rating = checkedRating ? checkedRating.value : null
      const explanation = field.value

      // An untouched empty field needs no write; clearing saved text does.
      if (!rating && !explanation.trim() && !this.savedExplanations.get(queryDocPairId)?.trim()) {
        this.showStatus(queryDocPairId, "")
        return
      }

      this.showStatus(queryDocPairId, "saving")

      try {
        await postJson(this.saveUrlValue, {
          query_doc_pair_id: queryDocPairId,
          rating: rating,
          explanation: explanation
          })

        this.savedExplanations.set(queryDocPairId, explanation)
        this.showStatus(queryDocPairId, "saved")
      } catch (error) {
        this.showStatus(queryDocPairId, "error")
        console.error("Error saving explanation:", error)
      }
    }, 1000)) // Wait 1 second after typing stops
  }

  updateRatingButtons(queryDocPairId, selectedRating) {
    // Update radio button state and handle btn-preselected class
    const radios = this.element.querySelectorAll(`input[name="judgement_${queryDocPairId}"]`)
    const labels = this.element.querySelectorAll(`#qdp_${queryDocPairId} .rating-buttons-container label`)
    
    // First remove btn-preselected from all labels
    labels.forEach(label => {
      label.classList.remove('btn-preselected')
    })
    
    // Then update radio states and add btn-preselected to selected button
    radios.forEach(radio => {
      if (radio.value === selectedRating) {
        radio.checked = true
        // Find the corresponding label and add btn-preselected class
        const label = this.element.querySelector(`label[for="${radio.id}"]`)
        if (label) {
          label.classList.add('btn-preselected')
        }
      }
    })
  }

  showResetButton(queryDocPairId) {
    const existingButton = this.element.querySelector(`button[data-query-doc-pair-id="${queryDocPairId}"][data-action*="resetRating"]`)

    if (!existingButton) {
      // Create reset button dynamically
      const ratingContainer = this.element.querySelector(`#qdp_${queryDocPairId} .rating-buttons .d-flex`)
      if (ratingContainer) {
        const resetButton = document.createElement('button')
        resetButton.type = 'button'
        resetButton.className = 'btn btn-sm btn-outline-secondary ms-3'
        resetButton.setAttribute('data-action', 'click->bulk-judgement#resetRating')
        resetButton.setAttribute('data-query-doc-pair-id', queryDocPairId)
        resetButton.title = 'Clear rating'
        resetButton.innerHTML = '<i class="bi bi-x-circle"></i> Reset'
        ratingContainer.appendChild(resetButton)
      }
    }
  }

  // Transient states (saved/reset) auto-clear after 2s (guarded); sticky states (error/typing/saving) don't.
  showStatus(queryDocPairId, status) {
    const statusElement = this.element.querySelector(`#status_${queryDocPairId}`)
    if (!statusElement) return

    switch (status) {
      case "saving":
        this.showStatusMessage(statusElement, {
          html: '<span class="spinner-border spinner-border-sm me-1 align-middle" role="status" aria-hidden="true"></span> Saving...',
          variantClass: "text-warning",
          variantClasses: STATUS_VARIANT_CLASSES
        })
        break
      case "saved":
        this.showStatusMessage(statusElement, {
          html: '<i class="bi bi-check-circle"></i> Saved',
          variantClass: "text-success",
          variantClasses: STATUS_VARIANT_CLASSES,
          autoHideMs: 2000
        })
        break
      case "reset":
        this.showStatusMessage(statusElement, {
          html: '<i class="bi bi-arrow-counterclockwise"></i> Reset',
          variantClass: "text-info",
          variantClasses: STATUS_VARIANT_CLASSES,
          autoHideMs: 2000
        })
        break
      case "error":
        this.showStatusMessage(statusElement, {
          html: '<i class="bi bi-x-circle"></i> Error saving',
          variantClass: "text-danger",
          variantClasses: STATUS_VARIANT_CLASSES
        })
        break
      case "typing":
        this.showStatusMessage(statusElement, {
          html: '<i class="bi bi-pencil"></i> Typing...',
          variantClass: "text-muted",
          variantClasses: STATUS_VARIANT_CLASSES
        })
        break
      default:
        this.showStatusMessage(statusElement, { html: "", variantClasses: STATUS_VARIANT_CLASSES })
    }
  }
}
