import ShareEntityControllerBase from "controllers/share_entity_controller_base"

/**
 * Share / unshare on cases index and teams — `<select>`, form POST, redirect.
 */
export default class extends ShareEntityControllerBase {
  get entityLabel() {
    return "Case"
  }

  get modalElementId() {
    return "shareCaseModal"
  }
}
