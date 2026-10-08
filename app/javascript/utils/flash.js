import { CORE_EVENTS } from "utils/core_events"
/**
 * Dispatches `document`-level flash events for the core case UI's Stimulus
 * `flash` controller (see `controllers/flash_controller.js`). Core controllers
 * use `coreFlash.show/hide` from `utils/core_flash`; this module owns event delivery.
 */

/**
 * @param {"success" | "error" | "warn" | "info"} type
 * @param {string | { parts: Array<{ text: string, href?: string }> }} message A plain-text
 *   string, or an object with `{ text, href? }` parts (e.g. a `SearchError`) whose links
 *   render as safe http(s) anchors and whose text is never parsed as markup.
 * @param {"main" | "search-error"} [target]
 * @param {{ html?: boolean }} [options] `html: true` renders `message` as markup instead of
 *   plain text — only for first-party-built strings (e.g. the mixed-content warning's link),
 *   never for server/user-supplied text.
 */
export function showFlash(type, message, target = "main", options = {}) {
  document.dispatchEvent(
    new CustomEvent(CORE_EVENTS.FLASH_SHOW, {
      detail: { type, message, target, html: !!options.html }
    })
  )
}

/**
 * @param {"main" | "search-error"} [target]
 */
export function hideFlash(target = "main") {
  document.dispatchEvent(new CustomEvent(CORE_EVENTS.FLASH_HIDE, { detail: { target } }))
}
