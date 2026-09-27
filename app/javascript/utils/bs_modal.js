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
 */
export function showBsModal(instance) {
  if (!instance) return
  instance.show()
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

/** Restore the outer modal's scroll lock after an inner modal closes. */
export function restoreModalBodyLock() {
  if (document.querySelector(".modal.show")) document.body.classList.add("modal-open")
}
