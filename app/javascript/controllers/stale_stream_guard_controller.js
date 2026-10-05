import { Controller } from "@hotwired/stimulus"

/**
 * Whether a stream would replace an element with one rendered earlier.
 * @param {HTMLElement} stream the <turbo-stream> about to render
 * @returns {boolean}
 */
function isStale(stream) {
  const current = document.getElementById(stream.getAttribute("target"))
  const incoming = stream.templateContent?.firstElementChild
  const shown = Number(current?.dataset.renderedAt)
  const arriving = Number(incoming?.dataset.renderedAt)
  return Boolean(shown && arriving && arriving < shown)
}

/**
 * Drops a Turbo Stream "replace" that is older than what the page already
 * shows. Turbo renders each stream after the next repaint -- an animation
 * frame while the page is visible, an event-loop tick while it is hidden --
 * so when visibility changes mid-run a late "Running 199/200" can land after
 * "Done". Elements that opt in carry data-rendered-at (server time in ms);
 * the check runs when Turbo renders, not when the stream arrives, since the
 * reordering happens in between.
 */
/**
 * Wraps a replace's render so it checks staleness when Turbo renders it,
 * not when the stream arrives.
 * @param {CustomEvent} event turbo:before-stream-render
 */
function guard(event) {
  const stream = event.target
  if (stream.getAttribute("action") !== "replace") return

  const render = event.detail.render
  event.detail.render = async (streamElement) => {
    if (isStale(streamElement)) return
    await render(streamElement)
  }
}

export default class extends Controller {
  /** Starts watching streams on the page. */
  connect() {
    document.addEventListener("turbo:before-stream-render", guard)
  }

  /** Stops watching. */
  disconnect() {
    document.removeEventListener("turbo:before-stream-render", guard)
  }
}
