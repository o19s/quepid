import { Controller } from "@hotwired/stimulus"
import { createBsPopover } from "utils/bs_popover"

// Rating-scale popover for search results, "Score All", and the Document
// Finder. Content here is plain DOM built from the scale value — the actual
// rating mutation (doc.rate / doc.resetRating, scoreAll propagation, etc.)
// still lives in Angular. This dispatches bubbling CustomEvents so whichever
// Angular controller wraps this element (SearchResultCtrl, SearchResultsCtrl,
// DocFinderCtrl) can handle the mutation without any id-based correlation.
export default class extends Controller {
  static values = {
    scale: Object,
    placement: { type: String, default: "auto right" }
  }

  connect() {
    this.handle = createBsPopover(this.element, {
      mode: "text",
      trigger: "outsideClick",
      placement: this.placementValue,
      html: true,
      body: this.renderBody()
    })
  }

  scaleValueChanged() {
    if (this.handle) this.handle.setBody(this.renderBody())
  }

  disconnect() {
    if (this.handle) this.handle.dispose()
    this.handle = null
  }

  renderBody() {
    const container = document.createElement("div")
    container.className = "ratingContainer"

    const list = document.createElement("ul")
    list.className = "ratingNums"

    Object.keys(this.scaleValue).forEach((rating) => {
      const entry = this.scaleValue[rating] || {}
      const item = document.createElement("li")
      item.className = "btn btn-sm ratingNum"
      item.style.backgroundColor = entry.color || ""
      item.textContent = rating

      if (entry.showScaleLabels === true) {
        const label = document.createElement("div")
        label.textContent = entry.label
        item.appendChild(label)
      }

      item.addEventListener("click", () => this.rate(rating))
      list.appendChild(item)
    })

    const reset = document.createElement("span")
    reset.className = "btn btn-outline-secondary btn-sm reset"
    reset.textContent = "RESET"
    reset.addEventListener("click", () => this.reset())
    list.appendChild(reset)

    container.appendChild(list)
    return container
  }

  rate(rating) {
    this.element.dispatchEvent(
      new CustomEvent("rating-popover:rate", { bubbles: true, detail: { rating } })
    )
    this.hide()
  }

  reset() {
    this.element.dispatchEvent(new CustomEvent("rating-popover:reset", { bubbles: true }))
    this.hide()
  }

  hide() {
    if (this.handle && this.handle.instance) this.handle.instance.hide()
  }
}
