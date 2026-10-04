/**
 * Bootstrap 5 modal helpers shared by Stimulus controllers that boot a
 * `window.bootstrap.Modal` (confirm-delete, document-fields, share-case-core).
 */

export function getBootstrapModal() {
  return window.bootstrap && window.bootstrap.Modal
}

function requireBootstrapModal(element) {
  const Modal = getBootstrapModal()
  if (!Modal) {
    console.warn("bs_modal: window.bootstrap.Modal not available; modal will not show", element)
  }
  return Modal
}

/**
 * @param {Element} element
 * @param {object} [options] passed through to `new bootstrap.Modal(element, options)`
 * @returns {import("bootstrap").Modal | null}
 */
export function createBsModal(element, options) {
  const Modal = requireBootstrapModal(element)
  return Modal ? new Modal(element, options) : null
}

/**
 * @param {Element} element
 * @param {object} [options] passed through to `Modal.getOrCreateInstance(element, options)`
 * @returns {import("bootstrap").Modal | null}
 */
export function getOrCreateBsModal(element, options) {
  const Modal = requireBootstrapModal(element)
  return Modal ? Modal.getOrCreateInstance(element, options) : null
}

/**
 * @param {import("bootstrap").Modal | null | undefined} instance
 * @param {object} [relatedTarget] passed to listeners as `show.bs.modal`'s `event.relatedTarget`
 */
export function showBsModal(instance, relatedTarget) {
  if (!instance) return
  instance.show(relatedTarget)
}

/**
 * @param {import("bootstrap").Modal | null | undefined} instance
 */
export function hideBsModal(instance) {
  if (!instance) return
  instance.hide()
}

/** Show a modal above any currently visible Bootstrap modal. */
export function showStackedModal(wrapper, modal) {
  const index = document.querySelectorAll(".modal.show").length
  if (index > 0) wrapper.style.zIndex = 1050 + index * 20

  modal.show()

  if (index > 0) {
    const backdrops = document.querySelectorAll(".modal-backdrop")
    const backdrop = backdrops[backdrops.length - 1]
    if (backdrop) backdrop.style.zIndex = 1040 + index * 20
  }
}

/**
 * Bootstrap only closes a modal on Escape while focus is inside it. When an
 * in-modal control is re-rendered or disabled, focus falls back to <body> and
 * Escape stops working. In that case, hand the keypress to the topmost open
 * modal so Bootstrap's own handler runs and still honors `keyboard: false`.
 *
 * @param {Document} [doc]
 */
export function installModalEscapeFallback(doc = document) {
  doc.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || event.defaultPrevented) return
    if (doc.activeElement && doc.activeElement !== doc.body) return

    // Layout modals precede dynamic ones, which are appended to <body> as they
    // open, so the last shown modal in DOM order is the topmost.
    const modals = doc.querySelectorAll(".modal.show")
    const modal = modals[modals.length - 1]
    if (!modal || modal.contains(event.target)) return
    modal.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
  })
}

/** Restore the outer modal's scroll lock after an inner modal closes. */
export function restoreModalBodyLock() {
  if (document.querySelector(".modal.show")) document.body.classList.add("modal-open")
}
