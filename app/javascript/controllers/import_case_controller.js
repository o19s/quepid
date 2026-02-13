import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["form", "fileInput", "alert", "submitButton", "submitText", "spinner"]

  connect() {
    console.log("Import case controller connected")
  }

  fileSelected(event) {
    const file = event.target.files[0]
    if (file) {
      // Validate it's a JSON file
      if (!file.type.match('application/json') && !file.name.endsWith('.json')) {
        this.showAlert('Please select a valid JSON file.', 'danger')
        this.submitButtonTarget.disabled = true
      } else {
        this.hideAlert()
        this.submitButtonTarget.disabled = false
      }
    }
  }

  async submit(event) {
    event.preventDefault()
    
    const file = this.fileInputTarget.files[0]
    if (!file) {
      this.showAlert('Please select a file to import.', 'warning')
      return
    }

    // Show loading state
    this.setLoading(true)
    this.hideAlert()

    try {
      // Read the file content
      const fileContent = await this.readFileAsText(file)
      let caseData
      
      try {
        caseData = JSON.parse(fileContent)
      } catch (e) {
        this.showAlert('Invalid JSON file. Please check the file format.', 'danger')
        this.setLoading(false)
        return
      }

      // Send to API - wrap in 'case' key as expected by API
      const response = await fetch(this.formTarget.action, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
        },
        body: JSON.stringify({ case: caseData })
      })

      const result = await response.json()

      if (response.ok) {
        this.showAlert('Case imported successfully! Redirecting...', 'success')
        setTimeout(() => {
          // Redirect to the imported case or refresh the page
          if (result.case_id) {
            window.location.href = `/case/${result.case_id}`
          } else {
            window.location.reload()
          }
        }, 1500)
      } else {
        const errorMessage = result.error || result.message || 'Failed to import case. Please check the file format.'
        this.showAlert(errorMessage, 'danger')
        this.setLoading(false)
      }
    } catch (error) {
      console.error('Import error:', error)
      this.showAlert('An error occurred while importing the case. Please try again.', 'danger')
      this.setLoading(false)
    }
  }

  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.onerror = (e) => reject(e)
      reader.readAsText(file)
    })
  }

  setLoading(isLoading) {
    this.submitButtonTarget.disabled = isLoading
    if (isLoading) {
      this.submitTextTarget.textContent = 'Importing...'
      this.spinnerTarget.classList.remove('d-none')
    } else {
      this.submitTextTarget.textContent = 'Import'
      this.spinnerTarget.classList.add('d-none')
    }
  }

  showAlert(message, type) {
    this.alertTarget.textContent = message
    this.alertTarget.className = `alert alert-${type}`
    this.alertTarget.classList.remove('d-none')
  }

  hideAlert() {
    this.alertTarget.classList.add('d-none')
  }
}