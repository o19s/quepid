import { Controller } from "@hotwired/stimulus"
import { getJson } from "api/json"
import { serviceFetch } from "api/service_fetch"

/**
 * A box for editing a JSON definition: says whether it is valid as it is typed, keeps the Create button off
 * until it is, can tidy it up, and can put the proposed definition back.
 */
export default class extends Controller {
  static targets = ["input", "name", "status", "submit", "availability", "availabilityButton"]
  static values = {
    original: String,
    originalName: String,
    newName: String,
    availabilityUrl: String,
    probe: Object
  }

  /**
   * Says at once whether the proposed definition is valid.
   */
  connect() {
    this.check()
  }

  /**
   * Says whether the text is a JSON object, and turns the Create button on or off with it.
   */
  check() {
    try {
      const parsed = JSON.parse(this.inputTarget.value)
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("it must be a JSON object, like { ... }")
      }
      this.show(true, "Valid JSON")
    } catch (error) {
      this.show(false, `Not valid JSON: ${error.message}`)
    }
  }

  /**
   * Lays the JSON out tidily, when it parses.
   */
  format() {
    try {
      this.inputTarget.value = JSON.stringify(JSON.parse(this.inputTarget.value), null, 2)
    } catch {
      // Not valid yet: check() says why, and there is nothing to tidy.
    }
    this.check()
  }

  /**
   * Puts the proposed definition and index name back.
   */
  reset() {
    this.inputTarget.value = this.originalValue
    if (this.hasNameTarget) this.nameTarget.value = this.originalNameValue
    this.check()
  }

  /**
   * The index to use: the endpoint's own keeps its name, a new one is named by the user.
   */
  choose(event) {
    if (!this.hasNameTarget) return
    const isNew = "true" === event.target.value
    this.nameTarget.readOnly = !isNew
    if (this.hasAvailabilityButtonTarget) this.availabilityButtonTarget.hidden = !isNew
    this.clearAvailability()
    if (isNew) {
      if (this.nameTarget.value === this.originalNameValue && this.newNameValue)
        this.nameTarget.value = this.newNameValue
      this.nameTarget.focus()
      this.nameTarget.select()
    } else {
      this.nameTarget.value = this.originalNameValue
    }
  }

  /**
   * Asks whether an index of this name is already on the endpoint's service: from the browser, as the case's searches
   * go, when the endpoint is not proxied (the Quepid server may not reach it, like a localhost one), else via the server.
   */
  async checkAvailability() {
    const name = this.nameTarget.value.trim()
    this.showAvailability("text-muted", "Checking…")
    try {
      const { status, message } =
        this.hasProbeValue && this.probeValue.origin
          ? await this.askService(name)
          : await this.askServer(name)
      this.showAvailability(
        "free" === status
          ? "text-success"
          : "taken" === status || "invalid" === status
            ? "text-danger"
            : "text-warning",
        message
      )
    } catch {
      this.showAvailability("text-warning", "Could not check the name.")
    }
  }

  /**
   * Asks Quepid, for an endpoint it reaches through its proxy.
   * @param {string} name
   * @returns {Promise<{status: string, message: string}>}
   */
  askServer(name) {
    const url = new URL(this.availabilityUrlValue, window.location.origin)
    url.searchParams.set("index_name", name)
    return getJson(url.toString())
  }

  /**
   * Asks the service itself, as the case's searches do, for an endpoint that is not proxied.
   * @param {string} name
   * @returns {Promise<{status: string, message: string}>}
   */
  async askService(name) {
    const { origin, engine, headers } = this.probeValue
    const path =
      "solr" === engine
        ? `/solr/admin/cores?action=STATUS&wt=json&core=${encodeURIComponent(name)}`
        : "qdrant" === engine
          ? `/collections/${encodeURIComponent(name)}`
          : `/${encodeURIComponent(name)}`
    try {
      const response = await serviceFetch(origin + path, { headers, credentials: "omit" })
      if ("solr" === engine && response.ok) {
        const taken = Object.keys((await response.json()).status?.[name] || {}).length > 0
        return this.verdict(name, taken)
      }
      if (response.ok) return this.verdict(name, true)
      if (404 === response.status) return this.verdict(name, false)
      return { status: "unknown", message: `${origin} answered ${response.status}.` }
    } catch {
      return {
        status: "unknown",
        message: `Your browser could not reach ${origin}: is it running, and does it allow requests from this page (CORS)?`
      }
    }
  }

  /**
   * The answer for a name that is taken, or free.
   */
  verdict(name, taken) {
    return {
      status: taken ? "taken" : "free",
      message: taken ? `${name} is already there.` : `${name} is free.`
    }
  }

  /**
   * Forgets the last answer: the name it was for has changed.
   */
  clearAvailability() {
    this.showAvailability("text-muted", "")
  }

  /**
   * Shows an answer about the name, in a text style (text-success, text-danger...).
   */
  showAvailability(style, message) {
    if (!this.hasAvailabilityTarget) return
    this.availabilityTarget.textContent = message
    this.availabilityTarget.className = `form-text ${style}`
  }

  /**
   * Shows whether the definition is valid, and lets it be created only if it is.
   */
  show(valid, message) {
    this.statusTarget.textContent = message
    this.statusTarget.classList.toggle("text-success", valid)
    this.statusTarget.classList.toggle("text-danger", !valid)
    if (this.hasSubmitTarget) this.submitTarget.disabled = !valid
  }
}
