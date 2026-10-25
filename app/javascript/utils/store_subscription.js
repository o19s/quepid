/** Subscribe to explicit store events; the caller owns initial rendering and cleanup. */
export function subscribeToStore(store, listeners) {
  const entries = Object.entries(listeners)
  entries.forEach(([event, handler]) => store.addEventListener(event, handler))
  return () => {
    entries.forEach(([event, handler]) => store.removeEventListener(event, handler))
  }
}
