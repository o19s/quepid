import { Controller } from "@hotwired/stimulus"
import Cookies from "js-cookie"

export default class extends Controller {
  connect() {
    if (Cookies.get("cookie_eu_consented") === "true") return
    this.toast = new window.bootstrap.Toast(this.element)
    this.toast.show()
  }

  accept() {
    Cookies.set("cookie_eu_consented", true, {
      path: "/",
      expires: 365,
      secure: location.protocol === "https:"
    })
    this.toast?.hide()
  }

  disconnect() {
    this.teardown()
  }

  teardown() {
    this.toast?.dispose()
    this.toast = null
    this.element.classList.remove("show", "showing")
  }
}
