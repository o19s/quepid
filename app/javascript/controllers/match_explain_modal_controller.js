import { Controller } from "@hotwired/stimulus"
import { renderJsonExplorer } from "utils/json_explorer"

// The cloned modal retains its content even if the originating result is replaced.
export default class extends Controller {
  static targets = ["title", "docId", "json", "score", "explanation"]

  connect() {
    const data = this.element.matchExplainData
    if (!data) return
    if (this.hasJsonTarget) {
      this.titleTarget.textContent = data.docTitle
      this.docIdTarget.textContent = data.docId
      renderJsonExplorer(this.jsonTarget, data.explainRawStr, { collapsed: false })
    } else {
      this.scoreTarget.textContent = data.docScore
      this.explanationTarget.textContent = data.hasChildren ? data.explainToStr : data.explainAsJson
    }
  }
}
