import { Controller } from "@hotwired/stimulus"
import { switchProtocol } from "utils/protocol"

// Opens a case on its search endpoint's protocol. The server renders a relative href
// (it may be rendering for a background broadcast with no request host), so the
// protocol is switched here against the host the page is actually on.
export default class extends Controller {
  static values = { protocol: String }

  connect() {
    const href = this.element.getAttribute("href")
    const url = switchProtocol(href, this.protocolValue)
    if (url && url.protocol !== new URL(href, window.location.href).protocol) {
      this.element.setAttribute("href", url.toString())
    }
  }
}
