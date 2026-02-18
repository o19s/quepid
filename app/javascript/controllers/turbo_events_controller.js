import { Controller } from "@hotwired/stimulus"

/**
 * Handles Turbo lifecycle events for loading states and form submit feedback.
 *
 * Listens for:
 * - turbo:before-fetch-request — show loading state on the requesting element (frame or form)
 * - turbo:frame-render — clear loading state after frame content loads
 * - turbo:submit-end — clear form loading state; show error via flash if submission failed
 *   (skips flash when response is HTML — server-rendered form errors are already in the frame)
 * - turbo:fetch-request-error — clear loading state on network failure
 *
 * Adds/removes the class `turbo-loading` on the target element. Style via CSS, e.g.:
 *   turbo-frame.turbo-loading { opacity: 0.6; pointer-events: none; }
 *   form.turbo-loading button[type="submit"], form.turbo-loading input[type="submit"] { opacity: 0.7; }
 *
 * Attach to body: <body data-controller="turbo-events">
 */
export default class extends Controller {
  static values = {
    loadingClass: { type: String, default: "turbo-loading" }
  }

  connect() {
    this.boundBeforeFetch = this._onBeforeFetch.bind(this)
    this.boundBeforeFetchResponse = this._onBeforeFetchResponse.bind(this)
    this.boundFrameRender = this._onFrameRender.bind(this)
    this.boundSubmitEnd = this._onSubmitEnd.bind(this)
    this.boundFetchError = this._onFetchError.bind(this)

    document.addEventListener("turbo:before-fetch-request", this.boundBeforeFetch)
    document.addEventListener("turbo:before-fetch-response", this.boundBeforeFetchResponse)
    document.addEventListener("turbo:frame-render", this.boundFrameRender)
    document.addEventListener("turbo:submit-end", this.boundSubmitEnd)
    document.addEventListener("turbo:fetch-request-error", this.boundFetchError)
  }

  disconnect() {
    document.removeEventListener("turbo:before-fetch-request", this.boundBeforeFetch)
    document.removeEventListener("turbo:before-fetch-response", this.boundBeforeFetchResponse)
    document.removeEventListener("turbo:frame-render", this.boundFrameRender)
    document.removeEventListener("turbo:submit-end", this.boundSubmitEnd)
    document.removeEventListener("turbo:fetch-request-error", this.boundFetchError)
  }

  _clearLoading(element) {
    if (element?.nodeType === Node.ELEMENT_NODE) {
      element.classList.remove(this.loadingClassValue)
    }
  }

  _onBeforeFetch(event) {
    const target = event.target
    if (target?.nodeType === Node.ELEMENT_NODE) {
      target.classList.add(this.loadingClassValue)
    }
  }

  _onBeforeFetchResponse(event) {
    this._clearLoading(event.target)
  }

  _onFrameRender(event) {
    this._clearLoading(event.target)
  }

  _onSubmitEnd(event) {
    this._clearLoading(event.target)

    const { success, fetchResponse, error } = event.detail || {}
    if (success === false && window.flash) {
      // Skip flash when server returned HTML (e.g. 422 form re-render) — frame already shows errors
      const ct = fetchResponse?.response?.headers?.get?.("Content-Type") || ""
      if (ct.includes("text/html")) return

      const message = this._extractErrorMessage(fetchResponse, error)
      window.flash.error = message
    }
  }

  _onFetchError(event) {
    this._clearLoading(event.target)

    if (window.flash) {
      const err = event.detail?.error
      window.flash.error = err?.message || "Network request failed."
    }
  }

  _extractErrorMessage(fetchResponse, error) {
    if (error?.message) return error.message
    const response = fetchResponse?.response
    if (response && !response.ok) {
      const status = response.status
      if (status >= 500) return "Server error. Please try again."
      if (status === 422) return "Validation failed. Please check your input."
      if (status >= 400) return `Request failed (${status}).`
    }
    return "Request failed. Please try again."
  }
}
