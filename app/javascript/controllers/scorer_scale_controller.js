import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["scaleList", "scaleLabels"]

  connect() {
    // Listen for changes on scale preset radio buttons
    this.element.querySelectorAll('input[name="scale_preset"]').forEach(radio => {
      radio.addEventListener('change', this.updateScale.bind(this))
    })
    
    // Listen for manual changes to scale_list field
    if (this.hasScaleListTarget) {
      this.scaleListTarget.addEventListener('input', this.handleScaleListInput.bind(this))
    }
  }

  handleScaleListInput(event) {
    const scaleValue = event.target.value.trim()
    if (scaleValue) {
      this.updateScaleLabels(scaleValue)
    }
  }

  updateScale(event) {
    const preset = event.target.value
    let scaleValue = ""

    switch(preset) {
      case 'binary':
        scaleValue = "0,1"
        break
      case 'graded':
        scaleValue = "0,1,2,3"
        break
      case 'detail':
        scaleValue = "1,2,3,4,5,6,7,8,9,10"
        break
      case 'custom':
        // Clear the field for custom and update placeholder
        if (this.hasScaleListTarget) {
          this.scaleListTarget.value = ""
          this.scaleListTarget.placeholder = "Provide a list of comma separated INTEGERS to use for the scoring scale"
        }
        return
    }

    if (this.hasScaleListTarget) {
      this.scaleListTarget.value = scaleValue
      this.scaleListTarget.placeholder = ""
      // Trigger change event to update scale labels if needed
      this.scaleListTarget.dispatchEvent(new Event('change', { bubbles: true }))
      this.updateScaleLabels(scaleValue)
    }
  }

  updateScaleLabels(scaleValue) {
    if (!this.hasScaleLabelsTarget) return

    const values = scaleValue.split(',').map(v => v.trim()).filter(v => v)
    const labelsContainer = this.scaleLabelsTarget
    
    labelsContainer.innerHTML = ''
    
    values.forEach(value => {
      const label = document.createElement('label')
      label.className = 'scale-with-label-element clearfix'
      label.style.display = 'inline-block'
      label.style.marginRight = '10px'
      label.innerHTML = `
        ${value}:
        <input
          class="form-control scale-label clearfix"
          type="text"
          name="scorer[scale_with_labels][${value}]"
          value=""
          style="width: 100px; display: inline-block;"
        />
      `
      labelsContainer.appendChild(label)
    })
  }
}
