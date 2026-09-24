import { createBsModal, restoreModalBodyLock, showStackedModal } from "utils/bs_modal"

/**
 * One-off Bootstrap 5 modal built from scratch and torn down on hide — the
 * vanilla-JS equivalent of what the deleted Angular `$quepidModal` shim did
 * for debug-matches/expand-content (no header/footer chrome, dismissible via
 * backdrop or Esc only, matching those two modals' original markup exactly).
 *
 * @param {{ html: string, size?: "sm"|"lg"|"xl", windowClass?: string, ariaLabelledBy?: string }} options
 * @returns {{ element: Element, dispose: () => void }}
 */
export function openDynamicModal({ html, templateId, size, windowClass, ariaLabelledBy } = {}) {
  const wrapper = document.createElement("div")
  wrapper.className = ["modal", "fade", windowClass].filter(Boolean).join(" ")
  wrapper.setAttribute("tabindex", "-1")
  wrapper.setAttribute("role", "dialog")
  if (ariaLabelledBy) wrapper.setAttribute("aria-labelledby", ariaLabelledBy)

  const sizeClass = size ? `modal-${size}` : ""
  const dialog = document.createElement("div")
  dialog.className = ["modal-dialog", sizeClass].filter(Boolean).join(" ")
  dialog.setAttribute("role", "document")
  const content = document.createElement("div")
  content.className = "modal-content"
  if (templateId) {
    const template = document.getElementById(templateId)
    if (!template) return null
    content.append(template.content.cloneNode(true))
  } else if (html) {
    content.innerHTML = html
  }
  dialog.appendChild(content)
  wrapper.appendChild(dialog)
  document.body.appendChild(wrapper)

  const bsModal = createBsModal(wrapper, { backdrop: true, keyboard: true, focus: true })

  function onHidden() {
    wrapper.removeEventListener("hidden.bs.modal", onHidden)
    bsModal?.dispose()
    wrapper.remove()
    // BS5's _hideModal unconditionally strips `modal-open` from <body> when
    // any modal closes, with no stack awareness. This modal can itself be
    // nested (e.g. opened from a doc row inside the Missing Documents or
    // Compare Snapshots modal, both of which embed search-result rows) —
    // re-apply here if another modal is still showing, or the outer one
    // silently loses its scroll lock. Mirrors the deleted $quepidModal shim.
    restoreModalBodyLock()
  }
  wrapper.addEventListener("hidden.bs.modal", onHidden)

  if (bsModal) {
    // Stack-aware z-index: BS5 defaults .modal to 1050 and .modal-backdrop to
    // 1040, so two open modals tie and the inner backdrop renders *under*
    // the outer modal, leaving the outer's buttons clickable while the inner
    // is "on top". Bump per already-shown modal; BS5 appends its backdrop
    // synchronously inside show() (only the fade-in is async), so the most
    // recent .modal-backdrop right after show() returns is ours.
    showStackedModal(wrapper, bsModal)
  } else {
    onHidden()
  }

  // Callers (e.g. detailed-doc Close) should go through hide() so BS5 removes
  // its backdrop; jumping straight to onHidden leaves orphaned .modal-backdrop
  // nodes. hide() fires hidden.bs.modal → onHidden for the real teardown.
  function dispose() {
    if (bsModal) bsModal.hide()
    else onHidden()
  }

  return { element: wrapper, dispose }
}
