import { Controller } from "@hotwired/stimulus"
import { deactivateListItem } from "utils/share_case_teams"

/**
 * Shared base for the "share/unshare on an index page + team page" pattern used by
 * share-case/share-book/share-scorer/share-search-endpoint: `<select>` + two form
 * POSTs + redirect.
 *
 * The controller lives only on the modal element, which declares
 * `show.bs.modal-><identifier>#open`. Each row's share button is a plain
 * `data-bs-toggle="modal"` trigger carrying `data-<identifier>-name-value` and
 * `-url-value`. Bootstrap passes the clicked button as `event.relatedTarget`;
 * `open` titles the modal and loads the record's forms from that URL
 * (ShareModalsController) into the modal's Turbo Frame, and `loadFailed` replaces
 * the loading state with an error when that load fails.
 *
 * A concrete controller only needs to supply `entityLabel`.
 */
export default class extends Controller {
  static targets = [
    "frame",
    "loading",
    "loadError",
    "unshareTeamId",
    "teamSelect",
    "title",
    "submitButton",
    "unshareButton",
    "sharedList"
  ]

  connect() {
    this.selectedSharedTeamId = null
  }

  open(event) {
    // show.bs.modal bubbles; ignore it when it comes from a nested modal.
    if (event.target !== this.element) return

    const trigger = event.relatedTarget
    const read = (name) => trigger?.getAttribute?.(`data-${this.identifier}-${name}-value`) ?? ""
    this.openWith({ name: read("name"), url: read("url") })
  }

  openWith({ name, url }) {
    if (this.hasTitleTarget) {
      this.titleTarget.textContent = name
        ? `Share ${this.entityLabel}: ${name}`
        : `Share ${this.entityLabel}`
    }
    this.selectedSharedTeamId = null
    // The forms load with the frame, so nothing is submittable until they arrive.
    if (this.hasSubmitButtonTarget) this.submitButtonTarget.disabled = true
    if (this.hasUnshareButtonTarget) this.unshareButtonTarget.disabled = true

    if (!this.hasFrameTarget) return
    // Drop the previous record's forms before loading this one's; setting src
    // reloads even when it is unchanged, and cancels any load still in flight.
    this.frameTarget.replaceChildren(
      ...(this.hasLoadingTarget ? [this.loadingTarget.content.cloneNode(true)] : [])
    )
    this.frameTarget.setAttribute("src", url)
  }

  // turbo:frame-missing (an error page came back) and turbo:fetch-request-error
  // (the request itself failed). The login page never reaches here: its
  // turbo-visit-control meta makes Turbo load it as a full page instead. Aborted
  // loads, such as one superseded by reopening the modal, dispatch neither.
  loadFailed(event) {
    // Stop Turbo replacing the frame with its own "Content missing" message.
    if (event.type === "turbo:frame-missing") event.preventDefault()
    if (!this.hasFrameTarget || !this.hasLoadErrorTarget) return
    this.frameTarget.replaceChildren(this.loadErrorTarget.content.cloneNode(true))
  }

  toggleSubmit() {
    if (!this.hasSubmitButtonTarget || !this.hasTeamSelectTarget) return
    this.submitButtonTarget.disabled = !this.teamSelectTarget.value
  }

  toggleUnshareSubmit() {
    if (!this.hasUnshareButtonTarget) return
    this.unshareButtonTarget.disabled = !this.selectedSharedTeamId
    if (this.hasUnshareTeamIdTarget) {
      this.unshareTeamIdTarget.value = this.selectedSharedTeamId
        ? String(this.selectedSharedTeamId)
        : ""
    }
  }

  selectSharedTeam(event) {
    const teamId = String(event.params.teamId)

    deactivateListItem(this.sharedListTarget, this.selectedSharedTeamId)

    if (String(this.selectedSharedTeamId) === teamId) {
      this.selectedSharedTeamId = null
    } else {
      this.selectedSharedTeamId = teamId
      const el = event.currentTarget || event.target
      el.classList.add("active")
    }

    this.toggleUnshareSubmit()
  }
}
