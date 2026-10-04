import ImportFormControllerBase from "controllers/import_form_controller_base"
import { postJson } from "api/json"
import { HttpError } from "api/http_error"

export default class extends ImportFormControllerBase {
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
      const fileContent = await file.text()
      let caseData
      
      try {
        caseData = JSON.parse(fileContent)
      } catch (e) {
        this.showAlert('Invalid JSON file. Please check the file format.', 'danger')
        this.setLoading(false)
        return
      }

      // Send to API - wrap in 'case' key as expected by API
      const result = await postJson(this.formTarget.action, { case: caseData })
      this.showAlert("Case imported successfully! Redirecting...", "success")
      setTimeout(() => {
        if (result.redirect_url) {
          window.location.href = result.redirect_url
        } else {
          window.location.reload()
        }
      }, 1500)
    } catch (error) {
      console.error('Import error:', error)
      if (error instanceof HttpError) {
        const result = error.data || {}
        const validationMessages = Object.entries(result)
          .filter(([, value]) => Array.isArray(value))
          .map(([field, messages]) => `${field} ${messages.join(", ")}`)
        this.showAlert(result.error || result.message || validationMessages.join(". ") || "Failed to import case. Please check the file format.", "danger")
      } else {
        this.showAlert("An error occurred while importing the case. Please try again.", "danger")
      }
      this.setLoading(false)
    }
  }

}
