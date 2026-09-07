/**
 * Animates an element's text content stepping from one numeric value to
 * another, replacing the removed angular-countup vendor directive.
 */

const DEFAULT_STEPS = 5
const DEFAULT_DURATION_MS = 500

const timers = new WeakMap()

export function animateCountUp(element, fromValue, toValue, options = {}) {
  const steps = options.steps || DEFAULT_STEPS
  const durationMs = options.durationMs || DEFAULT_DURATION_MS
  const to = Number.isFinite(toValue) ? toValue : 0
  const from = Number.isFinite(fromValue) ? fromValue : to

  stopCountUp(element)

  if (from === to) {
    element.textContent = String(to)
    return
  }

  let step = 0
  const timer = window.setInterval(() => {
    step += 1
    element.textContent = String(Math.round(from + ((to - from) / steps) * step))

    if (step >= steps) stopCountUp(element)
  }, durationMs / steps)

  timers.set(element, timer)
}

export function stopCountUp(element) {
  const timer = timers.get(element)
  if (!timer) return

  window.clearInterval(timer)
  timers.delete(element)
}
