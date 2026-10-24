import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["textarea", "scorerSelect"]
  static values = { scaleLengths: Object, fourPoint: String, twoPoint: String }

  // Called when the rating scale dropdown changes
  scaleChanged() {
    const scorerId = this.scorerSelectTarget.value
    if (!scorerId) return

    const scaleLength = this.scaleLengthsValue[scorerId]
    if (!scaleLength) return

    // Only auto-populate if the textarea is empty or matches a default
    const currentValue = this.textareaTarget.value.trim()
    const fourPoint = this.fourPointValue
    const twoPoint = this.twoPointValue

    const isEmptyOrDefault = currentValue === '' ||
                              currentValue === fourPoint ||
                              currentValue === twoPoint

    if (isEmptyOrDefault) {
      if (scaleLength === 2) {
        this.textareaTarget.value = twoPoint
      } else if (scaleLength === 4) {
        this.textareaTarget.value = fourPoint
      }
      // For other scale lengths, leave as-is or use four-point as fallback
      else if (currentValue === '') {
        this.textareaTarget.value = fourPoint
      }
    }
  }
}
