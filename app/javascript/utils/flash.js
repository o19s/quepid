/**
 * Client-side flash message utility for the Stimulus/Modern stack.
 *
 * Stimulus controllers set `window.flash.success` or `window.flash.error` to show
 * feedback. This module initializes `window.flash` and renders messages into the
 * `#flash` container in the layout (see layouts/_header.html.erb).
 *
 * For redirects: use `window.flash.store(type, message)` before navigating away.
 * Stored messages are restored and displayed on the next page load.
 *
 * Bootstrap classes match application_helper#bootstrap_class_for:
 * - success -> alert-success
 * - error   -> alert-danger
 * - info    -> alert-info
 * - notice  -> alert-info
 * - alert   -> alert-warning
 *
 * @example
 *   if (window.flash) window.flash.success = "Query deleted."
 *   if (window.flash) window.flash.store("success", "Query deleted.")  // before redirect
 */
const FLASH_TYPES = ["success", "error", "info", "notice", "alert"]
const ALERT_CLASSES = {
  success: "alert-success",
  error: "alert-danger",
  info: "alert-info",
  notice: "alert-info",
  alert: "alert-warning"
}

function showFlash(type, message) {
  const container = document.getElementById("flash")
  if (!container || !message) return

  const alertClass = ALERT_CLASSES[type] || "alert-info"
  const div = document.createElement("div")
  div.className = `alert ${alertClass} alert-dismissible fade show`
  div.setAttribute("role", "alert")
  div.innerHTML = `${escapeHtml(String(message))}<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>`
  container.appendChild(div)
}

function escapeHtml(text) {
  const div = document.createElement("div")
  div.textContent = text
  return div.innerHTML
}

const STORAGE_KEY_PREFIX = "flash_"

function storeFlash(type, message) {
  if (!FLASH_TYPES.includes(type) || !message) return
  try {
    sessionStorage.setItem(`${STORAGE_KEY_PREFIX}${type}`, String(message))
  } catch (_e) {
    /* sessionStorage may be unavailable (private browsing, etc.) */
  }
}

function restoreFlash() {
  const container = document.getElementById("flash")
  if (!container) return

  for (const type of FLASH_TYPES) {
    try {
      const message = sessionStorage.getItem(`${STORAGE_KEY_PREFIX}${type}`)
      if (message) {
        sessionStorage.removeItem(`${STORAGE_KEY_PREFIX}${type}`)
        showFlash(type, message)
      }
    } catch (_e) {
      /* ignore */
    }
  }
}

export function initFlash() {
  if (window.flash) return

  const target = {}
  target.store = function (type, message) {
    storeFlash(type, message)
  }

  window.flash = new Proxy(target, {
    set(t, prop, value) {
      if (FLASH_TYPES.includes(prop) && value) {
        showFlash(prop, String(value))
      }
      t[prop] = value
      return true
    }
  })

  restoreFlash()
}
