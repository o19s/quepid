/**
 * Dispatches a flash message event that the flash_controller picks up.
 *
 * @param {string} message - The message to display
 * @param {string} [type="success"] - Bootstrap alert type: success, danger, warning, info
 * @param {number} [duration=5000] - Auto-dismiss delay in ms (0 = no auto-dismiss)
 */
export function showFlash(message, type = "success", duration = 5000) {
  document.dispatchEvent(
    new CustomEvent("flash:show", {
      detail: { message, type, duration },
    }),
  )
}
