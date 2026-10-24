/**
 * Bootstrap 5 modal helpers shared by Stimulus controllers that boot a
 * `window.bootstrap.Modal` (confirm-dialog, document-fields, share-case-core).
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
  const visible = [...document.querySelectorAll(".modal.show")]
  const index = visible.length
  const outer = visible[index - 1]
  const returnFocus = document.activeElement
  const outerModal = outer && getBootstrapModal().getInstance(outer)
  // Bootstrap's document-wide focus handlers cannot serve two active traps.
  // Keep this private Bootstrap integration confined to the stacking adapter.
  outerModal?._focustrap?.deactivate()
  if (outer) {
    wrapper.addEventListener(
      "hidden.bs.modal",
      () => {
        if (!outer.isConnected || !outer.classList.contains("show")) return
        outerModal?._focustrap?.activate()
        if (returnFocus?.isConnected && outer.contains(returnFocus) && !returnFocus.disabled) {
          returnFocus.focus()
        }
        restoreModalBodyLock()
      },
      { once: true }
    )
  }
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
 * Escape during opening is replayed once Bootstrap can accept dismissal.
 *
 * @param {Document} [doc]
 */
export function installModalEscapeFallback(doc = document) {
  const opening = new Map()
  doc.addEventListener("show.bs.modal", (event) => {
    if (event.defaultPrevented) return
    opening.set(event.target, false)
    queueMicrotask(() => {
      if (event.defaultPrevented) opening.delete(event.target)
    })
  })
  doc.addEventListener("shown.bs.modal", (event) => {
    const pending = opening.get(event.target)
    opening.delete(event.target)
    // Bootstrap ignores hide() until shown. Replay through its keyboard
    // handler so keyboard:false and hide prevention still belong to Bootstrap.
    if (pending)
      event.target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
  })
  doc.addEventListener("hidden.bs.modal", (event) => opening.delete(event.target))
  doc.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Escape" || event.defaultPrevented) return
      for (const modal of opening.keys()) {
        if (!modal.isConnected) opening.delete(modal)
      }
      if (opening.size === 0) return
      const modal = [...opening.keys()].at(-1)
      opening.set(modal, true)
      event.preventDefault()
      event.stopPropagation()
    },
    true
  )

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

const TABBABLE =
  'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])'

function tabbableWithin(modal) {
  return [...modal.querySelectorAll(TABBABLE)].filter(
    (el) => !el.disabled && el.tabIndex >= 0 && (el.checkVisibility?.() ?? true)
  )
}

/**
 * Bootstrap's focus trap only reacts to `focusin`. Tabbing past the last
 * control of the topmost modal hands focus to the browser chrome (`<body>`
 * for one keypress) before the trap pulls it back. Wrap explicitly at the
 * ends so focus never leaves the dialog.
 *
 * @param {Document} [doc]
 */
export function installModalTabWrap(doc = document) {
  doc.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || event.defaultPrevented) return

    const modals = doc.querySelectorAll(".modal.show")
    const modal = modals[modals.length - 1]
    if (!modal || !modal.contains(event.target)) return

    const tabbable = tabbableWithin(modal)
    if (tabbable.length === 0) return
    const edge = tabbable[event.shiftKey ? 0 : tabbable.length - 1]
    // The dialog itself holds focus right after it opens (tabindex="-1").
    const atStart = event.shiftKey && event.target === modal
    if (!atStart && event.target !== edge && doc.activeElement !== edge) return

    event.preventDefault()
    tabbable[event.shiftKey ? tabbable.length - 1 : 0].focus()
  })
}

/** Restore the outer modal's scroll lock after an inner modal closes. */
export function restoreModalBodyLock() {
  if (document.querySelector(".modal.show")) document.body.classList.add("modal-open")
}
