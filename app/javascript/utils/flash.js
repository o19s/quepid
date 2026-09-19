/**
 * Dispatches `document`-level flash events for the core case UI's Stimulus
 * `flash` controller (see `controllers/flash_controller.js`). Legacy Angular
 * controllers call this via `window.quepidDom.flash` since they can't reach
 * a Stimulus controller's actions directly.
 */

/**
 * @param {"success" | "error" | "warn" | "info"} type
 * @param {string} message
 * @param {"main" | "search-error"} [target]
 * @param {{ html?: boolean }} [options] `html: true` renders `message` as markup instead of
 *   plain text — only for first-party-built strings (e.g. the mixed-content warning's link),
 *   never for server/user-supplied text.
 */
export function showFlash(type, message, target = "main", options = {}) {
  document.dispatchEvent(
    new CustomEvent("flash:show", { detail: { type, message, target, html: !!options.html } })
  )
}

/**
 * @param {"main" | "search-error"} [target]
 */
export function hideFlash(target = "main") {
  document.dispatchEvent(new CustomEvent("flash:hide", { detail: { target } }))
}
