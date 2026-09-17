import ShareEntityControllerBase from "controllers/share_entity_controller_base"

/**
 * Share / unshare on books index and teams — `<select>`, form POST, redirect.
 */
export default class extends ShareEntityControllerBase {
  get entityLabel() {
    return "Book"
  }

  get modalElementId() {
    return "shareBookModal"
  }
}
