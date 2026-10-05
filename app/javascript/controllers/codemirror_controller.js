import { Controller } from "@hotwired/stimulus"
import { fromTextArea } from "modules/editor"

export default class extends Controller {
  connect() {
    const data = this.element.dataset
    this.editor = fromTextArea(this.element, {
      mode: data.codemirrorMode,
      height: Number(data.codemirrorHeight) || undefined,
      width: Number(data.codemirrorWidth) || undefined,
      readOnly: data.codemirrorReadonly === "true"
    })
  }

  disconnect() {
    this.teardown()
  }

  teardown() {
    this.editor?.destroy()
    this.editor = null
  }
}
