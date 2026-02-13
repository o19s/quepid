import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["form", "fileInput", "alert", "submitButton", "submitText", "spinner", "preview", "previewContent"]

  connect() {
    console.log("Import snapshot controller connected")
  }

  async fileSelected(event) {
    const file = event.target.files[0]
    if (!file) {
      this.hidePreview()
      this.submitButtonTarget.disabled = true
      return
    }

    // Validate it's a CSV file
    if (!file.type.match('text/csv') && !file.name.endsWith('.csv')) {
      this.showAlert('Please select a valid CSV file.', 'danger')
      this.submitButtonTarget.disabled = true
      this.hidePreview()
      return
    }

    try {
      // Read and validate the file
      const fileContent = await this.readFileAsText(file)
      const validation = this.validateCSV(fileContent)
      
      if (!validation.valid) {
        this.showAlert(validation.error, 'danger')
        this.submitButtonTarget.disabled = true
        this.hidePreview()
      } else {
        this.hideAlert()
        this.showPreview(fileContent)
        this.submitButtonTarget.disabled = false
      }
    } catch (error) {
      this.showAlert('Error reading file. Please try again.', 'danger')
      this.submitButtonTarget.disabled = true
      this.hidePreview()
    }
  }

  validateCSV(content) {
    const lines = content.trim().split('\n')
    if (lines.length < 2) {
      return { valid: false, error: 'CSV file is empty or has no data rows.' }
    }

    const headers = lines[0].split(',').map(h => h.trim())
    const expectedHeaders = [
      'Snapshot Name', 'Snapshot Time', 'Case ID', 'Query Text', 'Doc ID', 'Doc Position'
    ]

    const missingHeaders = expectedHeaders.filter(header => !headers.includes(header))
    
    if (missingHeaders.length > 0) {
      return {
        valid: false,
        error: `Missing required headers: ${missingHeaders.join(', ')}. Please check spelling and capitalization.`
      }
    }

    return { valid: true }
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
      
      // Parse CSV to structured data
      const snapshotData = this.parseCSV(fileContent)
      
      if (snapshotData.length === 0) {
        this.showAlert('No valid data found in CSV file.', 'danger')
        this.setLoading(false)
        return
      }

      // Group data by case and send to API
      await this.importSnapshots(snapshotData)

      this.showAlert('Snapshots imported successfully! Refreshing...', 'success')
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (error) {
      console.error('Import error:', error)
      const errorMessage = error.message || 'An error occurred while importing snapshots. Please try again.'
      this.showAlert(errorMessage, 'danger')
      this.setLoading(false)
    }
  }

  parseCSV(content) {
    const lines = content.trim().split('\n')
    const headers = lines[0].split(',').map(h => h.trim())
    
    const data = []
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim())
      if (values.length !== headers.length) continue
      
      const row = {}
      headers.forEach((header, index) => {
        row[header] = values[index]
      })
      data.push(row)
    }
    
    return data
  }

  async importSnapshots(docs) {
    // Group by case ID and snapshot name
    const cases = {}

    docs.forEach(doc => {
      const caseId = doc['Case ID']
      if (!cases[caseId]) {
        cases[caseId] = { snapshots: {} }
      }

      const snapshotName = doc['Snapshot Name']
      if (!cases[caseId].snapshots[snapshotName]) {
        cases[caseId].snapshots[snapshotName] = {
          queries: {},
          created_at: doc['Snapshot Time'],
          name: snapshotName
        }
      }

      const snapshot = cases[caseId].snapshots[snapshotName]
      const queryText = doc['Query Text']
      
      if (!snapshot.queries[queryText]) {
        snapshot.queries[queryText] = { docs: [] }
      }

      const docPayload = {
        id: doc['Doc ID'],
        position: doc['Doc Position']
      }

      snapshot.queries[queryText].docs.push(docPayload)
    })

    // Convert to API format and send requests
    const promises = []
    
    for (const [caseId, caseData] of Object.entries(cases)) {
      for (const [snapshotName, snapshot] of Object.entries(caseData.snapshots)) {
        const snapshotPayload = {
          name: snapshot.name,
          created_at: snapshot.created_at,
          queries: Object.entries(snapshot.queries).map(([queryText, queryData]) => ({
            query_text: queryText,
            docs: queryData.docs
          }))
        }
        
        promises.push(this.sendSnapshotToAPI(caseId, snapshotPayload))
      }
    }

    const results = await Promise.allSettled(promises)
    
    // Check for failures
    const failures = results.filter(r => r.status === 'rejected')
    if (failures.length > 0) {
      throw new Error(`${failures.length} snapshot(s) failed to import. Some may have been imported successfully.`)
    }
  }

  async sendSnapshotToAPI(caseId, snapshotData) {
    const url = `/api/cases/${caseId}/snapshots/imports`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
      },
      body: JSON.stringify({ snapshots: [snapshotData] })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || `Failed to import snapshot for case ${caseId}`)
    }

    return response.json()
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

  showPreview(content) {
    const lines = content.split('\n')
    const preview = lines.slice(0, 10).join('\n')
    const remaining = lines.length - 10
    
    this.previewContentTarget.textContent = preview
    if (remaining > 0) {
      this.previewContentTarget.textContent += `\n... (${remaining} more lines)`
    }
    this.previewTarget.classList.remove('d-none')
  }

  hidePreview() {
    this.previewTarget.classList.add('d-none')
  }
}