import { Controller } from "@hotwired/stimulus"
import { apiFetch } from "api/fetch"
import { createBsPopover } from "utils/bs_popover"

export default class extends Controller {
  static values = { url: String, title: String }

  connect() {
    this.opened = false
    this.element.setAttribute("aria-expanded", "false")
    this.element.removeAttribute("aria-controls")
  }

  async toggle() {
    if (this.opened) return this.close()

    this.handle ||= createBsPopover(this.element, {
      trigger: "manual",
      placement: "bottom",
      fallbackPlacements: ["top"],
      html: true,
      body: this.template("connectionUsageLoading")
    })
    this.opened = true
    this.element.setAttribute("aria-expanded", "true")
    this.handle.setBody(
      this.loadedContent?.cloneNode(true) || this.template("connectionUsageLoading")
    )
    this.handle.instance?.show()
    if (this.loadedContent) return

    const request = new AbortController()
    this.request = request
    try {
      const response = await apiFetch(this.urlValue, {
        headers: { Accept: "text/html" },
        signal: request.signal
      })
      if (!response.ok) throw new Error("Unable to load usage")
      const html = new DOMParser().parseFromString(await response.text(), "text/html")
      const content = html.querySelector("[data-connection-usage-list]")
      if (!content) throw new Error("Missing usage list")
      if (request.signal.aborted) return

      this.loadedContent = document.importNode(content, true)
      this.replaceBody(this.loadedContent.cloneNode(true))
    } catch {
      if (!request.signal.aborted) this.replaceBody(this.template("connectionUsageError"))
    }
  }

  replaceBody(content) {
    // Reset Bootstrap's manual-show state before replacing a visible tip.
    this.handle.instance?.hide()
    this.handle.setBody(content)
    this.handle.instance?.show()
  }

  get popover() {
    return document.getElementById(this.element.getAttribute("aria-describedby"))
  }

  shown() {
    const popover = this.popover
    if (!popover) return
    popover.setAttribute("role", "dialog")
    popover.setAttribute("aria-label", this.titleValue)
    this.element.setAttribute("aria-controls", popover.id)
    // Focus the links without scrolling to the tip before Popper positions it.
    if (document.activeElement === this.element) {
      popover.querySelector("a")?.focus({ preventScroll: true })
    }
  }

  dismissOutside(event) {
    if (this.element.contains(event.target) || this.popover?.contains(event.target)) return
    this.close()
  }

  escape() {
    if (!this.opened) return
    this.close()
    this.element.focus()
  }

  close() {
    this.opened = false
    this.request?.abort()
    this.handle?.instance?.hide()
    this.element.setAttribute("aria-expanded", "false")
    this.element.removeAttribute("aria-controls")
  }

  disconnect() {
    this.close()
    this.handle?.dispose()
  }

  template(id) {
    return document.getElementById(id).content.firstElementChild.cloneNode(true)
  }
}
