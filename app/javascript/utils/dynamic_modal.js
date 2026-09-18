import { createBsModal } from "utils/bs_modal"

/**
 * One-off Bootstrap 5 modal built from scratch and torn down on hide — the
 * vanilla-JS equivalent of what the deleted Angular `$quepidModal` shim did
 * for debug-matches/expand-content (no header/footer chrome, dismissible via
 * backdrop or Esc only, matching those two modals' original markup exactly).
 *
 * @param {{ html: string, size?: "sm"|"lg"|"xl", windowClass?: string }} options
 * @returns {{ element: Element, dispose: () => void }}
 */
export function openDynamicModal({ html, size, windowClass } = {}) {
  const wrapper = document.createElement("div")
  wrapper.className = ["modal", "fade", windowClass].filter(Boolean).join(" ")
  wrapper.setAttribute("tabindex", "-1")
  wrapper.setAttribute("role", "dialog")

  const sizeClass = size ? `modal-${size}` : ""
  wrapper.innerHTML = `
    <div class="modal-dialog ${sizeClass}" role="document">
      <div class="modal-content">${html}</div>
    </div>
  `
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
    if (document.querySelector(".modal.show")) {
      document.body.classList.add("modal-open")
    }
  }
  wrapper.addEventListener("hidden.bs.modal", onHidden)

  if (bsModal) {
    // Stack-aware z-index: BS5 defaults .modal to 1050 and .modal-backdrop to
    // 1040, so two open modals tie and the inner backdrop renders *under*
    // the outer modal, leaving the outer's buttons clickable while the inner
    // is "on top". Bump per already-shown modal; BS5 appends its backdrop
    // synchronously inside show() (only the fade-in is async), so the most
    // recent .modal-backdrop right after show() returns is ours.
    const stackIdx = document.querySelectorAll(".modal.show").length
    if (stackIdx > 0) wrapper.style.zIndex = 1050 + stackIdx * 20
    bsModal.show()
    if (stackIdx > 0) {
      const backdrops = document.querySelectorAll(".modal-backdrop")
      const ours = backdrops[backdrops.length - 1]
      if (ours) ours.style.zIndex = 1040 + stackIdx * 20
    }
  } else {
    onHidden()
  }

  return { element: wrapper, dispose: onHidden }
}
