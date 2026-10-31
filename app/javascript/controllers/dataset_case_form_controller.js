import { Controller } from "@hotwired/stimulus"
import { getOrCreateBsModal } from "utils/bs_modal"

/**
 * The "create a case from a dataset" form: the chosen dataset sets the case name and decides which
 * scorer list and sample size are shown. The hidden ones are disabled so only the visible ones are submitted. With
 * open set (the Datasets tab's Load to case), it opens the dialog it sits in.
 */
export default class extends Controller {
  static targets = ["dataset", "name", "scorerGroup"]
  static values = { open: Boolean }

  /**
   * Shows the scorers of the dataset chosen, and opens the dialog when asked to.
   */
  connect() {
    this.showScorers()
    if (this.openValue) this.open()
  }

  /**
   * Opens the dialog, and drops ?dataset= from the address so a reload or the loading refresh does not reopen it.
   */
  open() {
    getOrCreateBsModal(this.element.closest(".modal"))?.show()
    const url = new URL(window.location.href)
    if (!url.searchParams.has("dataset")) return
    url.searchParams.delete("dataset")
    window.history.replaceState(window.history.state, "", url)
  }

  /**
   * A dataset was picked: the case takes its default name, and its scorers are shown.
   */
  change() {
    const option = this.datasetTarget.selectedOptions[0]
    if (option) this.nameTarget.value = option.dataset.defaultName || ""
    this.showScorers()
  }

  /**
   * Shows only the chosen dataset's scorer list and sample size, and disables the others so they are not submitted.
   */
  showScorers() {
    const key = this.datasetTarget.value
    this.scorerGroupTargets.forEach((group) => {
      const shown = group.dataset.datasetKey === key
      group.hidden = !shown
      group.querySelectorAll("select, input").forEach((field) => {
        field.disabled = !shown
      })
    })
  }
}
