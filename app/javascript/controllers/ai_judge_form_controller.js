import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["structured", "json", "jsonTab", "provider", "preset", "help", "url", "version", "model", "images"]

  connect() {
    this.syncTab()
    this.showHelp()
  }

  syncTab() {
    const json = this.jsonTabTarget.classList.contains("active")
    this.jsonTarget.disabled = !json
    this.structuredTargets.forEach(field => { field.disabled = json })
    this.syncImages()
  }

  providerChanged() {
    const preset = this.currentPreset()
    if (!preset) return
    if (this.hasUrlTarget) this.urlTarget.value = preset.dataset.url
    if (this.hasVersionTarget) this.versionTarget.value = preset.dataset.version
    if (this.hasModelTarget) this.modelTarget.value = preset.dataset.model
    this.showHelp()
    this.syncImages()
  }

  syncImages() {
    if (this.hasImagesTarget) {
      this.imagesTarget.disabled = this.jsonTabTarget.classList.contains("active") ||
        (this.hasProviderTarget && this.providerTarget.value === "ollama")
    }
  }

  currentPreset() {
    if (!this.hasProviderTarget) return null
    return this.presetTargets.find(preset => preset.dataset.provider === this.providerTarget.value)
  }

  showHelp() {
    const preset = this.currentPreset()
    this.helpTarget.replaceChildren(...(preset ? [preset.content.cloneNode(true)] : []))
    this.helpTarget.style.display = preset ? "block" : "none"
  }
}
