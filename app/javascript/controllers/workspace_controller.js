import { Controller } from "@hotwired/stimulus"
import { getQuepidRootUrl } from "utils/quepid_root"

// Minimal workspace root controller. Provides the Quepid root URL (equivalent to
// caseTryNavSvc.getQuepidRootUrl()) via data-workspace-root-url-value from the
// core_modern layout. Use for navigation and API base URLs; never hardcode "/".
export default class extends Controller {
  static values = { rootUrl: String }

  get quepidRootUrl() {
    return this.rootUrlValue || getQuepidRootUrl()
  }
}
