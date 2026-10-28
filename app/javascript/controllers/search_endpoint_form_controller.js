import { Controller } from "@hotwired/stimulus"

// search_endpoints/_form.html.erb: proxying removes the cross-origin reason to use JSONP, and
// SearchEndpoint#validate_proxy_requests_api_method rejects the combination outright -- switch
// API Method to GET instead of making the user hit that validation error after submitting.
export default class extends Controller {
  static targets = ["proxyRequests", "apiMethod"]

  forceGetIfJsonpAndProxied() {
    if (this.proxyRequestsTarget.checked && this.apiMethodTarget.value === "JSONP") {
      this.apiMethodTarget.value = "GET"
    }
  }
}
