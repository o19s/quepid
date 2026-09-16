const generations = new WeakMap()

/**
 * Shared status/alert message helper for Stimulus controllers.
 *
 * Auto-hide is guarded: each call stamps the element with a generation
 * token, and the timeout only fires if it's still the most recent call, so
 * a later message (even one with identical content, e.g. two successive
 * "Saved" notifications) isn't stomped by an earlier call's timeout. The
 * guard only sees calls made through this function — code that mutates the
 * element's content directly, bypassing showStatusMessage, isn't tracked and
 * can still be clobbered by a pending timer.
 *
 * @param {Element} el
 * @param {object} options
 * @param {string} [options.message] plain text content, set via `textContent`
 * @param {string} [options.html] markup content, set via `innerHTML` (takes precedence over `message`)
 * @param {string} [options.className] full `className` to assign (replaces any existing classes)
 * @param {string} [options.variantClass] class to add when not using `className` (e.g. `text-success`)
 * @param {string[]} [options.variantClasses] full set of possible variant classes to remove first
 * @param {number} [options.autoHideMs] if set, clears the element after this delay (guarded)
 * @param {(el: Element) => void} [options.onExpire] custom auto-hide behavior; defaults to clearing content
 */
export function showStatusMessage(
  el,
  { message, html, className, variantClass, variantClasses, autoHideMs, onExpire } = {}
) {
  if (!el) return

  const useHtml = html !== undefined
  const content = useHtml ? html : (message ?? "")
  const generation = (generations.get(el) ?? 0) + 1
  generations.set(el, generation)

  if (useHtml) {
    el.innerHTML = content
  } else {
    el.textContent = content
  }

  if (className !== undefined) {
    el.className = className
  } else {
    if (variantClasses) el.classList.remove(...variantClasses)
    if (variantClass) el.classList.add(variantClass)
  }

  if (autoHideMs) {
    setTimeout(() => {
      if (generations.get(el) !== generation) return

      if (onExpire) {
        onExpire(el)
      } else if (useHtml) {
        el.innerHTML = ""
      } else {
        el.textContent = ""
      }
    }, autoHideMs)
  }
}
