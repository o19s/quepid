/**
 * Restart a feedback window after each display. Callers own rendering and
 * restoration, including when and how they capture the original label.
 */
export function createTemporaryFeedback(delay) {
  let timer = null

  return {
    show(render, restore) {
      render()
      clearTimeout(timer)
      timer = setTimeout(() => {
        restore()
        timer = null
      }, delay)
    },
    cancel() {
      clearTimeout(timer)
    }
  }
}
