import ShareEntityControllerBase from "controllers/share_entity_controller_base"

/**
 * Share / unshare on search endpoints index and teams — `<select>`, form POST, redirect.
 */
export default class extends ShareEntityControllerBase {
  get entityLabel() {
    return "Search Endpoint"
  }

  get modalElementId() {
    return "shareSearchEndpointModal"
  }
}
