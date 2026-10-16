// vega is available globally via the vega_globals importmap pin.
import { Controller } from "@hotwired/stimulus"
import { getJson } from "api/json"

// Fetches the server-built Vega spec for a case's try tree and mounts it.
// Finalizes the view on disconnect, including when the fetch or render is
// still in flight.
export default class extends Controller {
  static values = { specUrl: String }

  connect() {
    this.disconnected = false
    this.render().catch((error) => console.error(error))
  }

  disconnect() {
    this.disconnected = true
    this.view?.finalize()
    this.view = null
  }

  async render() {
    const spec = await getJson(this.specUrlValue)
    if (this.disconnected) return

    const view = new vega.View(vega.parse(spec), {
      renderer: "canvas",
      container: this.element,
      hover: true,
      // Opens the try links in the same window.
      loader: vega.loader({ target: "_self" })
    })
    this.view = view
    await view.runAsync()
  }
}
