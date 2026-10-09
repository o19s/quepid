import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["scaleList", "scaleLabels"]

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
    const labels = new Map(
      [...labelsContainer.querySelectorAll("input")].map(input => [input.name, input.value])
    )
    
    labelsContainer.innerHTML = ''
    
    values.forEach(value => {
      const label = document.createElement('label')
      label.className = 'clearfix'
      label.style.display = 'inline-block'
      label.style.marginRight = '10px'
      label.append(`${value}: `)
      const input = document.createElement('input')
      input.className = 'form-control clearfix'
      input.type = 'text'
      input.name = `scorer[scale_with_labels][${value}]`
      input.value = labels.get(input.name) || ""
      input.style.width = '100px'
      input.style.display = 'inline-block'
      label.appendChild(input)
      labelsContainer.appendChild(label)
    })
  }
}
