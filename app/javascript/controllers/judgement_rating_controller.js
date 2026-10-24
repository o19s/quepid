import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["rating", "submit", "button", "shortcut"]

  connect() {
    this.pending = false
  }

  disconnect() {
    this.cancel()
  }

  cancel() {
    clearTimeout(this.keyTimer)
    clearTimeout(this.submitTimer)
    this.pending = false
  }

  keydown(event) {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
    if (document.querySelector(".modal.show")) return
    if (event.target.closest("input, textarea, select, [contenteditable]")) return
    const key = event.key === ";" ? "sc" : event.key.toLowerCase()
    const button = this.buttonTargets.find(candidate => candidate.dataset.judgementRatingKeyParam === key)
    if (!button || this.pending) return
    this.highlight(key)
    clearTimeout(this.keyTimer)
    this.keyTimer = setTimeout(() => button.click(), 500)
  }

  rate(event) {
    if (this.pending) return
    clearTimeout(this.keyTimer)
    this.pending = true
    this.highlight(event.params.key)
    this.ratingTarget.value = event.params.rating
    this.submitTimer = setTimeout(() => {
      this.element.requestSubmit(this.submitTarget)
    }, 100)
  }

  highlight(key) {
    this.buttonTargets.forEach(button => {
      button.classList.toggle("btn-preselected", button.dataset.judgementRatingKeyParam === key)
    })
    this.shortcutTargets.forEach(shortcut => {
      const selected = shortcut.dataset.key === key
      shortcut.style.color = selected ? "black" : "gray"
      shortcut.style.fontWeight = selected ? "bold" : "normal"
    })
  }
}
