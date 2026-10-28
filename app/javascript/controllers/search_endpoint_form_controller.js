import { Controller } from "@hotwired/stimulus"

// search_endpoints/_form.html.erb: proxying removes the cross-origin reason to use JSONP, and
// SearchEndpoint#validate_proxy_requests_api_method rejects the combination outright -- warn the
// user up front instead of making them hit that validation error after submitting.
export default class extends Controller {
  static targets = ["proxyRequests", "apiMethod", "jsonpProxyWarning"]

  connect() {
    this.toggleJsonpProxyWarning()
  }

  toggleJsonpProxyWarning() {
    if (!this.hasProxyRequestsTarget) return

    const warn = this.proxyRequestsTarget.checked && this.apiMethodTarget.value === "JSONP"
    this.jsonpProxyWarningTarget.classList.toggle("d-none", !warn)
  }
}
